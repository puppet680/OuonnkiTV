import { useQuery } from '@tanstack/react-query'
import {
  fetchTmdbEpisodeGroups,
  fetchTmdbEpisodeGroup,
  type TmdbEpisodeGroupDetail,
} from '../lib/api/tmdb-detail'
import { useSettingStore } from '../store/settingStore'

interface EpisodeGroupCandidate {
  id: string
  name: string
  episode_count: number
  group_count: number
  type: number
}

/**
 * 从剧集组列表里挑选匹配的"季"分组（排除 Cours 拆分）
 * 只留组名含 Season/季 且不含 Cours/Part 的季分组（Cours 是每季拆半的 Part 1/Part 2，非完整季）；
 * 优先集数与当前剧总集数一致；否则选组数最少（最接近真实季数）。无季分组返回 null（回退 TMDB）
 */
function pickEpisodeGroup(
  groups: EpisodeGroupCandidate[] | undefined,
  totalEpisodes: number | undefined,
): EpisodeGroupCandidate | null {
  if (!groups || groups.length === 0) return null
  // 排除拆分分组（Cours / Part 1·2），只留真正的"季"分组
  const seasonGroups = groups.filter(
    group =>
      group.group_count > 1 &&
      /season|季/i.test(group.name) &&
      !/cour|part/i.test(group.name),
  )
  if (seasonGroups.length === 0) return null
  const byEpisodes = seasonGroups.filter(group => group.episode_count === totalEpisodes)
  const pool = byEpisodes.length > 0 ? byEpisodes : seasonGroups
  return pool.slice().sort((a, b) => a.group_count - b.group_count)[0] ?? null
}

/**
 * 拉取 TV 的 TMDB 剧集组（episode_groups），解析出官方制作季分组
 * 用于聚合 TMDB 只有单季但剧集组含多制作季的剧（如日本动画）
 * @param tvId - TV 的 TMDB ID；undefined 时不发起请求
 * @param totalEpisodes - 该剧总集数（number_of_episodes），用于挑选匹配的分组
 * @returns detail - 选中剧集组的详情（groups 按制作季分组）；无匹配组或加载失败为 null
 */
export function useTmdbEpisodeGroups(
  tvId: number | undefined,
  totalEpisodes?: number,
): { detail: TmdbEpisodeGroupDetail | null } {
  const language = useSettingStore.getState().system.tmdbLanguage

  const listQuery = useQuery({
    queryKey: ['tmdb', 'episode_groups', tvId, language],
    queryFn: () => fetchTmdbEpisodeGroups(tvId!),
    enabled: !!tvId,
    staleTime: 30 * 60_000,
    retry: 1,
  })

  const selected = pickEpisodeGroup(listQuery.data, totalEpisodes)

  const detailQuery = useQuery({
    queryKey: ['tmdb', 'episode_group', selected?.id, language],
    queryFn: ({ signal }) => fetchTmdbEpisodeGroup(selected!.id, language, signal),
    enabled: !!selected,
    staleTime: 30 * 60_000,
    retry: 1,
  })

  return { detail: (detailQuery.data ?? null) as TmdbEpisodeGroupDetail | null }
}
