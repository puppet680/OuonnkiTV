import pLimit from "p-limit";
import type { MergedLinks, SearchResult } from "../types/models";

/**
 * 合并去重搜索结果（按 unique_id/message_id/首个链接/标题+频道+时间 去重）
 */
export function mergeUniqueResults(
  a: SearchResult[],
  b: SearchResult[]
): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  const pushUnique = (result: SearchResult) => {
    const firstLink = Array.isArray(result.links) ? result.links[0]?.url : "";
    const key =
      result.unique_id ||
      result.message_id ||
      firstLink ||
      `${result.title}|${result.channel}|${result.datetime || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(result);
  };

  for (const result of a) pushUnique(result);
  for (const result of b) pushUnique(result);
  return out;
}

/** 按时间降序排序（缺失/非法时间视为最旧排末尾，避免 NaN 比较器） */
export function sortResultsByTimeDesc(arr: SearchResult[]) {
  const toTime = (value?: string): number => {
    if (!value) return 0;
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : 0;
  };
  arr.sort((x, y) => toTime(y.datetime) - toTime(x.datetime));
}

/**
 * 按链接类型分组合并（cloudTypes 过滤 + 标题作 note）
 */
export function mergeResultsByType(
  results: SearchResult[],
  _keyword: string,
  cloudTypes?: string[]
): MergedLinks {
  const allow =
    cloudTypes && cloudTypes.length > 0
      ? new Set(cloudTypes.map((value) => value.toLowerCase()))
      : undefined;
  const out: MergedLinks = {};
  for (const result of results) {
    for (const link of result.links || []) {
      const type = (link.type || "").toLowerCase();
      if (allow && !allow.has(type)) continue;
      if (!out[type]) out[type] = [];
      out[type].push({
        url: link.url,
        password: link.password,
        note: result.title,
        datetime: result.datetime,
        images: result.images,
      });
    }
  }
  return out;
}

/**
 * 给 Promise 加超时：超时后 abort 底层请求并返回 fallback，避免 socket/内存泄漏
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  controller?: AbortController
): Promise<T> {
  if (!ms || ms <= 0) return promise;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => {
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
      resolve(fallback);
    }, ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutHandle)),
    timeoutPromise,
  ]);
}

/** 并发执行任务（pLimit 限流），返回按原顺序的结果 */
export function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const limitFn = pLimit(limit);
  const limitedTasks = tasks.map((task) => limitFn(task));
  return Promise.all(limitedTasks);
}
