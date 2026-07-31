# 技术债登记

原则：以下为存量违规，只登记不重构；**新增/改动代码必须合规**（见 CLAUDE.md）。改到哪个文件，顺手合规哪个，改完移除对应行。

**阻塞新功能**列：高 = 新功能会复制该坏模式（异步写法/竞态），优先修；低 = 纯技术债（行数），不阻塞开发。

## 异步状态（React Query 边界）

| 编号 | 文件 | 违规项 | 阻塞新功能 |
|------|------|--------|-----------|
| V001 | src/shared/store/tmdbStore.ts | 12 个 async action + 12 个 loading 布尔，重复 try/catch；服务端数据 persist | 高 |
| V002 | src/shared/store/tmdbStore.ts | 手写请求 ID 防竞态（latestSearchRequestId） | 低 |
| V003 | src/shared/hooks/useTmdbDetail.ts | 模块级 Map 做服务端缓存 | 中 |
| V004 | src/shared/hooks/useCmsCore.ts | 三处 useState+useEffect+fetch 手写异步 | 中 |
| V005 | src/features/search/hooks/useDirectSearch.ts | requestVersionRef 竞态 + ref 缓存（375 行，超 hook 80 行阈值） | 高 |
| V006 | src/shared/store/tmdbMatchCacheStore.ts | IndexedDB 持久化服务端缓存，与 RQ 缓存并存待评估 | 低 |
| V007 | src/shared/hooks/useTmdbSearch.ts | 返回 11 个字段（超 6 个阈值）；store 转发型取数 | 低 |

## 待评估事项

### V006 — tmdbMatchCacheStore（IndexedDB 服务端缓存）

后续迭代专门评估，方向二选一：

- **废弃**：若 TMDB 匹配结果不需要跨会话持久化，或可移入 RQ 内存缓存 + `persistQueryClient`，删除该 store，改走 RQ
- **迁移**：若必须跨会话保留（IndexedDB 容量/离线需求），保留 IndexedDB 但将其纳入 RQ 边界规则（作为 RQ 的持久化后端之一）

**评估判据：** TMDB 匹配缓存是否需在会话间存活、IndexedDB 容量上限、与 RQ 缓存的重复度。触发时机：引入 `persistQueryClient` 或改动 TMDB 匹配/播放列表功能时。

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
