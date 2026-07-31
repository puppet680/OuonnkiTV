import { UnifiedCache, CacheNamespace } from "../cache/unifiedCache";
import { safeExecute } from "../utils/fetch";
import type { SearchResponse, SearchResult } from "../types/models";
import { PluginManager, type AsyncSearchPlugin } from "../plugins/manager";
import {
  PluginHealthChecker,
  createPluginHealthChecker,
} from "../plugins/pluginHealth";
import {
  ErrorCollector,
  classifyError,
  type WarningInfo,
} from "../utils/errors";
import { buildSearchKeywordVariants } from "../utils/searchKeyword";
import {
  mergeUniqueResults,
  sortResultsByTimeDesc,
  mergeResultsByType,
  withTimeout,
  runWithConcurrency,
} from "./searchResultUtils";

export interface SearchServiceOptions {
  priorityChannels: string[];
  defaultChannels: string[];
  defaultConcurrency: number;
  pluginTimeoutMs: number;
  cacheEnabled: boolean;
  cacheTtlMinutes: number;
}

export class SearchService {
  private static readonly TG_CHANNEL_LIMIT = 80;
  private static readonly TG_DEEP_CHANNEL_LIMIT = 160;
  private static readonly TG_DEEP_SEARCH_TRIGGER = 3;
  private static readonly PLUGIN_VARIANT_TRIGGER = 5;

  private options: SearchServiceOptions;
  private pluginManager: PluginManager;
  private cache: UnifiedCache;
  private healthChecker: PluginHealthChecker;

  constructor(options: SearchServiceOptions, pluginManager: PluginManager) {
    this.options = options;
    this.pluginManager = pluginManager;
    this.cache = new UnifiedCache(
      {
        enabled: options.cacheEnabled,
        ttlMinutes: options.cacheTtlMinutes,
      },
      "search"
    );

    this.healthChecker = createPluginHealthChecker();
  }

  getPluginManager() {
    return this.pluginManager;
  }

  async search(
    keyword: string,
    channels: string[] | undefined,
    concurrency: number | undefined,
    forceRefresh: boolean | undefined,
    resultType: string | undefined,
    sourceType: "all" | "tg" | "plugin" | undefined,
    plugins: string[] | undefined,
    cloudTypes: string[] | undefined,
    ext: Record<string, unknown> | undefined,
    signal?: AbortSignal
  ): Promise<SearchResponse> {
    const { response } = await this.searchWithWarnings(
      keyword,
      channels,
      concurrency,
      forceRefresh,
      resultType,
      sourceType,
      plugins,
      cloudTypes,
      ext,
      signal
    );

    return response;
  }

  async searchWithWarnings(
    keyword: string,
    channels: string[] | undefined,
    concurrency: number | undefined,
    forceRefresh: boolean | undefined,
    resultType: string | undefined,
    sourceType: "all" | "tg" | "plugin" | undefined,
    plugins: string[] | undefined,
    cloudTypes: string[] | undefined,
    ext: Record<string, unknown> | undefined,
    signal?: AbortSignal
  ): Promise<{ response: SearchResponse; warnings: WarningInfo[] }> {
    // 客户端已断开，直接返回空结果
    if (signal?.aborted) {
      return { response: { total: 0 }, warnings: [] };
    }

    const errorCollector = new ErrorCollector();
    const effChannels =
      channels && channels.length > 0 ? channels : this.options.defaultChannels;
    const effConcurrency =
      concurrency && concurrency > 0
        ? concurrency
        : this.options.defaultConcurrency;
    const effResultType =
      !resultType || resultType === "merge" ? "merged_by_type" : resultType;
    const effSourceType = sourceType ?? "all";

    let tgResults: SearchResult[] = [];
    let pluginResults: SearchResult[] = [];

    const tasks: Array<() => Promise<void>> = [];

    if (effSourceType === "all" || effSourceType === "tg") {
      tasks.push(async () => {
        const concOverride =
          typeof concurrency === "number" && concurrency > 0
            ? concurrency
            : undefined;
        tgResults = await this.searchTG(
          keyword,
          effChannels,
          !!forceRefresh,
          concOverride,
          ext,
          signal
        );
      });
    }
    if (effSourceType === "all" || effSourceType === "plugin") {
      tasks.push(async () => {
        pluginResults = await this.searchPlugins(
          keyword,
          plugins,
          !!forceRefresh,
          effConcurrency,
          ext ?? {},
          errorCollector,
          signal
        );
      });
    }

    await Promise.all(tasks.map((task) => task()));

    const allResults = mergeUniqueResults(tgResults, pluginResults);
    sortResultsByTimeDesc(allResults);

    const filteredForResults: SearchResult[] = [];
    for (const result of allResults) {
      const hasTime = !!result.datetime;
      const hasLinks = Array.isArray(result.links) && result.links.length > 0;
      if (hasTime || hasLinks) {
        filteredForResults.push(result);
      }
    }

    const mergedLinks = mergeResultsByType(
      allResults,
      keyword,
      cloudTypes
    );

    let total = 0;
    let response: SearchResponse = { total: 0 };
    if (effResultType === "merged_by_type") {
      total = Object.values(mergedLinks).reduce(
        (sum, items) => sum + items.length,
        0
      );
      response = { total, merged_by_type: mergedLinks };
    } else if (effResultType === "results") {
      total = filteredForResults.length;
      response = { total, results: filteredForResults };
    } else {
      total = filteredForResults.length;
      response = {
        total,
        results: filteredForResults,
        merged_by_type: mergedLinks,
      };
    }

    return {
      response,
      warnings: errorCollector.getWarnings(),
    };
  }

  private async searchTG(
    keyword: string,
    channels: string[] | undefined,
    forceRefresh: boolean,
    concurrencyOverride?: number,
    ext?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const chList = Array.isArray(channels) ? channels : [];
    const cacheKey = `tg:${keyword}:${[...chList].sort().join(",")}`;
    const { cacheEnabled, priorityChannels } = this.options;

    if (!forceRefresh && cacheEnabled) {
      const cached = this.cache.get(CacheNamespace.TG_SEARCH, cacheKey);
      if (cached.hit && cached.value) {
        return cached.value;
      }
    }

    const { fetchTgChannelPosts } = await import("./tg");
    const requestedTimeout =
      typeof ext?.__plugin_timeout_ms === "number" ? ext.__plugin_timeout_ms : 0;
    const timeoutMs = Math.max(
      3000,
      requestedTimeout > 0
        ? requestedTimeout
        : this.options.pluginTimeoutMs || 0
    );
    const concurrency = Math.max(
      2,
      Math.min(concurrencyOverride ?? this.options.defaultConcurrency, 5)
    );

    const prioritySet = new Set(priorityChannels || []);
    const priorityList = chList.filter((channel) => prioritySet.has(channel));
    const normalList = chList.filter((channel) => !prioritySet.has(channel));

    const createChannelTask =
      (channel: string, limitPerChannel: number) => async () => {
        // 客户端断开时跳过
        if (signal?.aborted) return [];

        const controller = new AbortController();
        // 将外部取消和超时合并：任一触发都会 abort
        const mergedSignal = signal
          ? AbortSignal.any([signal, controller.signal])
          : controller.signal;

        const result = await safeExecute(
          () =>
            withTimeout<SearchResult[]>(
              fetchTgChannelPosts(channel, keyword, {
                limitPerChannel,
                signal: mergedSignal,
              }),
              timeoutMs,
              [],
              controller
            ),
          []
        );
        return result;
      };

    const flattenResults = (items: SearchResult[][]) => {
      const flattened: SearchResult[] = [];
      for (const arr of items) {
        if (Array.isArray(arr)) {
          flattened.push(...arr);
        }
      }
      return flattened;
    };

    const shallowTasks = [...priorityList, ...normalList].map((channel) =>
      createChannelTask(channel, SearchService.TG_CHANNEL_LIMIT)
    );
    const shallowResults = flattenResults(
      await runWithConcurrency(shallowTasks, concurrency)
    );

    let results = shallowResults;
    if (
      results.length < SearchService.TG_DEEP_SEARCH_TRIGGER &&
      keyword.trim().length > 1 &&
      chList.length > 0
    ) {
      const deepTasks = [...priorityList, ...normalList].map((channel) =>
        createChannelTask(channel, SearchService.TG_DEEP_CHANNEL_LIMIT)
      );
      const deepResults = flattenResults(
        await runWithConcurrency(deepTasks, concurrency)
      );
      results = mergeUniqueResults(results, deepResults);
    }

    if (cacheEnabled && results.length > 0) {
      this.cache.set(CacheNamespace.TG_SEARCH, cacheKey, results);
    }

    return results;
  }

  private async searchPlugins(
    keyword: string,
    plugins: string[] | undefined,
    forceRefresh: boolean,
    concurrency: number,
    ext: Record<string, unknown>,
    errorCollector: ErrorCollector,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const cacheKey = `plugin:${keyword}:${(plugins ?? [])
      .map((plugin) => plugin?.toLowerCase())
      .filter(Boolean)
      .sort()
      .join(",")}`;
    const { cacheEnabled } = this.options;

    if (!forceRefresh && cacheEnabled) {
      const cached = this.cache.get(CacheNamespace.PLUGIN_SEARCH, cacheKey);
      if (cached.hit && cached.value) {
        return cached.value;
      }
    }

    const allPlugins = this.pluginManager.getPlugins();
    const healthyPlugins = allPlugins.filter((plugin) =>
      this.healthChecker.isHealthy(plugin.name())
    );

    let available: AsyncSearchPlugin[] = [];
    if (plugins && plugins.length > 0 && plugins.some((plugin) => !!plugin)) {
      const wanted = new Set(plugins.map((plugin) => plugin.toLowerCase()));
      available = healthyPlugins.filter((plugin) =>
        wanted.has(plugin.name().toLowerCase())
      );
    } else {
      available = healthyPlugins;
    }

    const requestedTimeout =
      typeof ext?.__plugin_timeout_ms === "number" ? ext.__plugin_timeout_ms : 0;
    const timeoutMs = Math.max(
      3000,
      requestedTimeout > 0
        ? requestedTimeout
        : this.options.pluginTimeoutMs || 0
    );

    const pluginPromises = available.map((plugin) => async () => {
      plugin.setMainCacheKey(cacheKey);
      plugin.setCurrentKeyword(keyword);

      const startTime = Date.now();
      const pluginName = plugin.name();

      try {
        const queries =
          (keyword || "").trim().length <= 1
            ? [keyword, "电影", "movie", "1080p"]
            : buildSearchKeywordVariants(keyword).slice(0, 3);

        let results: SearchResult[] = [];
        for (const [index, query] of queries.entries()) {
          // 客户端断开时跳过剩余查询
          if (signal?.aborted) break;

          // 为每次插件请求创建独立的 AbortController，
          // 超时后 withTimeout 会 abort，使底层请求有机会被真正取消（而非泄漏）
          const controller = new AbortController();
          // 将外部取消和超时合并：任一触发都会 abort
          const mergedSignal = signal
            ? AbortSignal.any([signal, controller.signal])
            : controller.signal;
          const currentResults = await withTimeout<SearchResult[]>(
            plugin.search(query, { ...ext, signal: mergedSignal }),
            timeoutMs,
            [],
            controller
          );

          results = mergeUniqueResults(results, currentResults || []);

          if (
            results.length >= SearchService.PLUGIN_VARIANT_TRIGGER ||
            index === queries.length - 1
          ) {
            break;
          }
        }

        const responseTime = Date.now() - startTime;
        this.healthChecker.recordSuccess(pluginName, responseTime);

        return results;
      } catch (error) {
        // 记录失败，使插件健康检查熔断器能够触发
        this.healthChecker.recordFailure(pluginName);
        throw error;
      }
    });

    const resultsByPlugin = await runWithConcurrency(
      pluginPromises.map((promiseFactory) => async () => {
        try {
          return await promiseFactory();
        } catch (error) {
          const errorDetail = classifyError(error, "plugin_search");
          errorCollector.record(errorDetail);
          return [];
        }
      }),
      concurrency
    );

    const merged: SearchResult[] = [];
    for (const arr of resultsByPlugin) {
      if (Array.isArray(arr)) {
        merged.push(...arr);
      }
    }

    if (cacheEnabled && merged.length > 0) {
      this.cache.set(CacheNamespace.PLUGIN_SEARCH, cacheKey, merged);
    }

    return merged;
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache(namespace?: CacheNamespace) {
    if (namespace) {
      this.cache.clearNamespace(namespace);
    } else {
      this.cache.clearAll();
    }
  }

  getPluginHealthStatus() {
    return this.healthChecker.getAllStatus();
  }

  resetPluginHealth(pluginName?: string) {
    if (pluginName) {
      this.healthChecker.reset(pluginName);
    } else {
      this.healthChecker.resetAll();
    }
  }
}
