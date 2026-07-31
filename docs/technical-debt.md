# 技术债登记

原则：以下为存量违规，只登记不重构；**新增/改动代码必须合规**（见 CLAUDE.md）。改到哪个文件，顺手合规哪个，改完移除对应行。

**阻塞新功能**列：高 = 新功能会复制该坏模式（异步写法/竞态），优先修；低 = 纯技术债（行数），不阻塞开发。

## 异步状态（React Query 边界）

| 编号 | 文件 | 违规项 | 状态 |
|------|------|--------|------|
| V005 | src/features/search/hooks/useDirectSearch.ts | requestVersionRef 竞态 + ref 缓存（375 行，超 hook 80 行阈值） | 规则豁免：CMS 事件流式，CLAUDE.md 明示沿用现有 hook |
| V006 | src/shared/store/tmdbMatchCacheStore.ts | IndexedDB 持久化服务端缓存，与 RQ 缓存并存 | 暂缓，待评估并入 RQ persist |
| V014 | src/features/media/components/tmdb-detail/usePlaylistMatches.ts | 事件驱动匹配搜索 + 缓存 store（617 行） | 规则豁免：CMS 事件流式 |
| V015 | src/features/player/hooks/useSourceSpeedTest.ts | 手动 worker 池 + localStorage 缓存 | 规则豁免：长任务进度，进度存本地 state |

## 待评估事项

### V006 — tmdbMatchCacheStore（IndexedDB 服务端缓存）

**状态：暂缓，待评估并入 RQ persist。**

决策背景：匹配结果需跨会话存活（有 TTL 与容量上限、离线价值），维持独立 IndexedDB store。项目已引入 `persistQueryClient`（RQ 层持久化），后续评估是否将匹配缓存并入 RQ 查询 + persist 白名单。

**评估判据：** TMDB 匹配缓存与 RQ persist 的重复度、容量上限差异、`usePlaylistMatches` 的读写/驱逐语义能否无损映射到 RQ `setQueryData` + `maxAge`。触发时机：改动 TMDB 匹配/播放列表功能时。

## 文件行数

行数为 `wc -l` 实测值。

| 编号 | 文件 | 行数 | 违反 | 阻塞新功能 |
|------|------|------|------|-----------|
| V008 | src/features/player/components/VideojsPlayer.tsx | 2435 | 500 行上限 | 低 |
| V009 | src/shared/store/tmdbStore.ts | 1018 | 500 行上限 | 低 |
| V010 | src/features/player/components/VideojsSkin.tsx | 733 | 500 行上限 | 低 |
| V011 | src/features/media/components/tmdb-detail/DetailPlaylistTab.tsx | 680 | 500 行上限 | 低 |
| V012 | src/features/media/components/tmdb-detail/usePlaylistMatches.ts | 617 | 500 行上限 | 低 |
| V013 | src/features/home/components/FeaturedCarousel.tsx | 529 | 500 行上限 | 低 |
| … | 其余超 500 行文件（20+ 个） | — | 500 行上限 | 低 |
