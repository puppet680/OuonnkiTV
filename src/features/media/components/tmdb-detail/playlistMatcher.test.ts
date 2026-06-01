import { describe, expect, it } from 'vitest'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { VideoItem } from '@ouonnki/cms-core'
import type { DetailSeason } from './types'
import { buildPlaylistMatches } from './playlistMatcher'

function makeVideoItem(overrides: Partial<VideoItem> = {}): VideoItem {
  return {
    vod_id: '12345', vod_name: '测试影片', source_code: 'test_source',
    source_name: '测试源', vod_year: '2024', type_name: '', vod_remarks: '',
    ...overrides,
  }
}

function makeSeason(overrides: Partial<DetailSeason> = {}): DetailSeason {
  return { id: 1, season_number: 1, name: '第一季', episode_count: 12, air_date: '2024-01-01', overview: '', poster_path: null, ...overrides }
}

const defaultSources = [{ id: 'test_source', name: '测试源' }]

describe('buildPlaylistMatches', () => {
  it('完全相同标题 ≈ 满分', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie', items: [makeVideoItem({ vod_name: 'Inception' })],
      title: 'Inception', sources: defaultSources, seasons: [],
    })
    expect(movieSourceMatches[0].bestMatch!.score).toBeGreaterThanOrEqual(95)
  })

  it('部分匹配过关', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie', items: [makeVideoItem({ vod_name: '进击的巨人 最终季' })],
      title: '进击的巨人', sources: defaultSources, seasons: [],
    })
    expect(movieSourceMatches[0].bestMatch).not.toBeNull()
  })

  it('完全不相关标题被过滤', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie', items: [makeVideoItem({ vod_name: 'The Matrix Resurrections' })],
      title: 'Finding Nemo', sources: defaultSources, seasons: [],
    })
    expect(movieSourceMatches[0].bestMatch).toBeNull()
  })

  it('originalTitle 也参与匹配', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: 'Sen to Chihiro no Kamikakushi', vod_id: '1' })],
      title: 'Spirited Away', originalTitle: 'Sen to Chihiro no Kamikakushi',
      sources: defaultSources, seasons: [],
    })
    expect(movieSourceMatches[0].bestMatch).not.toBeNull()
  })

  it('相似度 < 0.28 被过滤', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: 'ABCDEFGH', vod_id: '1' }), makeVideoItem({ vod_name: 'XYZWVUTS', vod_id: '2' })],
      title: '大明王朝1566', sources: defaultSources, seasons: [],
    })
    expect(movieSourceMatches.filter(m => m.bestMatch !== null).length).toBe(0)
  })

  it('年份差 >= 5 扣 -10，差 = 1 扣 -2，同年不扣', () => {
    const items = [makeVideoItem({ vod_name: 'Inception', vod_year: '2010' })]
    const run = (year: string) =>
      buildPlaylistMatches({ mediaType: 'movie' as const, items, title: 'Inception', releaseYear: year, sources: defaultSources, seasons: [] }).movieSourceMatches[0].bestMatch!.score
    expect(run('2010') - run('2020')).toBe(10)
    expect(run('2011') - run('2020')).toBe(8)
    expect(run('2014') - run('2020')).toBe(5)
  })

  it('媒体类型不匹配扣 -5', () => {
    const seasonScore = buildPlaylistMatches({
      mediaType: 'movie', items: [makeVideoItem({ vod_name: 'Inception', type_name: '第二季' })],
      title: 'Inception', sources: defaultSources, seasons: [],
    }).movieSourceMatches[0].bestMatch!.score
    const neutralScore = buildPlaylistMatches({
      mediaType: 'movie', items: [makeVideoItem({ vod_name: 'Inception', type_name: '', vod_id: '2' })],
      title: 'Inception', sources: defaultSources, seasons: [],
    }).movieSourceMatches[0].bestMatch!.score
    expect(seasonScore).toBeLessThan(neutralScore)
  })

  it('预告/花絮/解说扣 -5', () => {
    const clipScore = buildPlaylistMatches({
      mediaType: 'movie', items: [makeVideoItem({ vod_name: 'Inception', vod_remarks: '预告片' })],
      title: 'Inception', sources: defaultSources, seasons: [],
    }).movieSourceMatches[0].bestMatch!.score
    const normalScore = buildPlaylistMatches({
      mediaType: 'movie', items: [makeVideoItem({ vod_name: 'Inception', vod_remarks: '', vod_id: '2' })],
      title: 'Inception', sources: defaultSources, seasons: [],
    }).movieSourceMatches[0].bestMatch!.score
    expect(clipScore).toBeLessThan(normalScore)
  })

  it('去重按 source_code::vod_id', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: 'Inception 2010', vod_id: '1' }), makeVideoItem({ vod_name: 'Inception', vod_id: '1' })],
      title: 'Inception', sources: defaultSources, seasons: [],
    })
    expect(movieSourceMatches).toHaveLength(1)
    expect(movieSourceMatches[0].bestMatch).not.toBeNull()
  })

  it('电视剧类型返回 seasonSourceMatches', () => {
    const result = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items: [makeVideoItem({ vod_name: 'Breaking Bad', type_name: '美剧' })],
      title: 'Breaking Bad', sources: defaultSources, seasons: [makeSeason()],
    })
    expect(result.movieSourceMatches).toHaveLength(0)
    expect(result.seasonSourceMatches.length).toBeGreaterThan(0)
  })

  it('seasonHints 正确提取', () => {
    const { candidates } = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items: [makeVideoItem({ vod_name: 'Breaking Bad Season 1', vod_remarks: 'Season 2' })],
      title: 'Breaking Bad', sources: defaultSources, seasons: [makeSeason()],
    })
    expect(candidates[0].seasonHints).toContain(1)
    expect(candidates[0].seasonHints).toContain(2)
  })

  it('空标题返回空结果', () => {
    const { candidates, movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie', items: [makeVideoItem()], title: '', sources: defaultSources, seasons: [],
    })
    expect(candidates).toHaveLength(0)
    expect(movieSourceMatches[0].bestMatch).toBeNull()
  })

  it('空 items 返回空结果', () => {
    const { candidates, movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie', items: [], title: 'Inception', sources: defaultSources, seasons: [],
    })
    expect(candidates).toHaveLength(0)
    expect(movieSourceMatches[0].bestMatch).toBeNull()
  })

  // --- 译名减分测试 ---

  it('译名精确命中高分且未命中项被过滤', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [
        makeVideoItem({ vod_name: 'Inception', vod_id: '1' }),
        makeVideoItem({ vod_name: 'Inception 全面启动', vod_id: '2' }),
      ],
      title: 'Inception', alternativeTitles: ['全面启动'],
      sources: defaultSources, seasons: [],
    })
    // 译名精确命中的是 bestMatch，未命中的被过滤掉
    const best = movieSourceMatches[0].bestMatch!
    expect(best.item.vod_id).toBe('2')
    expect(movieSourceMatches[0].alternatives).toHaveLength(0)
  })

  it('译名精确匹配中文标题高分', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: '千与千寻 神隐少女', vod_id: '1' })],
      title: 'Spirited Away', alternativeTitles: ['神隐少女'],
      sources: defaultSources, seasons: [],
    })
    expect(movieSourceMatches[0].bestMatch!.score).toBeGreaterThanOrEqual(70)
  })

  it('译名子串部分匹配扣 -10', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: '进击的巨人', vod_id: '1' })],
      title: '进击的巨人', alternativeTitles: ['进击的巨人最终季'],
      sources: defaultSources, seasons: [],
    })
    const s = movieSourceMatches[0].bestMatch!.score
    expect(s).toBeGreaterThanOrEqual(70)
    expect(s).toBeLessThanOrEqual(95)
  })

  it('译名未命中直接过滤', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: 'Inception', vod_id: '1' })],
      title: 'Inception', alternativeTitles: ['全面启动', '盗梦空间'],
      sources: defaultSources, seasons: [],
    })
    expect(movieSourceMatches[0].bestMatch).toBeNull()
  })

  it('无译名数据不扣译名分', () => {
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: 'Inception', vod_id: '1' })],
      title: 'Inception', sources: defaultSources, seasons: [],
    })
    expect(movieSourceMatches[0].bestMatch!.score).toBeGreaterThanOrEqual(80)
  })
})
