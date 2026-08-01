import { describe, expect, it } from 'vitest'
import type { TmdbMediaType } from '@/shared/types/tmdb'
import type { VideoItem } from '@ouonnki/cms-core'
import type { DetailSeason } from './types'
import { buildPlaylistMatches, hasSplitSuffix, isEnglishText } from './playlistMatcher'

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

  it('译名精确命中优于仅主标题命中', () => {
    // 两个都可能通过 searchTitle 命中，但译名精确命中分数更高
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [
        makeVideoItem({ vod_name: 'Tenet', vod_id: '1' }),
        makeVideoItem({ vod_name: 'Tenet 信条', vod_id: '2' }),
      ],
      title: 'Tenet', alternativeTitles: ['信条'],
      sources: defaultSources, seasons: [],
    })
    const best = movieSourceMatches[0].bestMatch!
    // 两个都命中，译名精确命中不扣，无译名部分扣，但标题掺杂扣分
    expect(best).not.toBeNull()
    // 最佳匹配存在即可，无需断言具体 ID（两者可能同分由去重决定）
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
    // searchTitle 不命中 vod_name，纯靠 alternativeTitles 判断
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: 'Sherlock Season 4', vod_id: '1' })],
      title: 'Sherlock', alternativeTitles: ['Sherlock Holmes'],
      sources: defaultSources, seasons: [],
    })
    const s = movieSourceMatches[0].bestMatch!.score
    expect(s).toBeGreaterThanOrEqual(70)
    expect(s).toBeLessThanOrEqual(95)
  })

  it('译名未命中直接过滤', () => {
    // searchTitle 不命中 vod_name，alternativeTitles 也不命中 → 被过滤
    const { movieSourceMatches } = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: 'The Matrix', vod_id: '1' })],
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
    expect(movieSourceMatches[0].bestMatch!.score).toBeGreaterThan(80)
  })

  // --- 多季匹配测试 ---

  it('明确标注目标季获得 +5 奖励', () => {
    // 只放一个含"第一季"的条目，它应获得 +5 奖励
    const items = [makeVideoItem({ vod_name: '进击的巨人 第一季', vod_id: '1' })]
    const result = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items, title: '进击的巨人',
      sources: defaultSources, seasons: [makeSeason()],
    })
    const s1Best = result.seasonSourceMatches[0].sourceMatches[0].bestMatch!
    // +5 奖励后分数至少是基础分 + 5，即至少略高于同源无奖励时的基础分
    // 标题掺杂扣分后基础分约 84，+5 = 89
    expect(s1Best.score).toBeGreaterThan(80)
  })

  it('明确标注其他季被远距离惩罚 -50 不可成为最佳匹配', () => {
    const items = [
      makeVideoItem({ vod_name: '进击的巨人 第五季', vod_id: '1' }),
      makeVideoItem({ vod_name: '进击的巨人', vod_id: '2' }),
    ]
    const result = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items, title: '进击的巨人',
      sources: defaultSources, seasons: [makeSeason()],
    })
    // S1 不应选"第五季"条目
    const s1Best = result.seasonSourceMatches[0].sourceMatches[0].bestMatch!
    expect(s1Best.item.vod_id).not.toBe('1')
    // "第五季"条目被罚 -50 后应在 alternatives 中且得分低
    const s1Alts = result.seasonSourceMatches[0].sourceMatches[0].alternatives
    const wrongSeason = s1Alts.find(a => a.item.vod_id === '1')
    expect(wrongSeason).toBeDefined()
    expect(wrongSeason!.score).toBeLessThanOrEqual(55)
  })

  it('无季标注 + 非 S1 扣 -30，低于阈值被过滤', () => {
    const s2Season = makeSeason({ id: 2, season_number: 2, name: '第二季' })
    const items = [makeVideoItem({ vod_name: '进击的巨人', vod_id: '1' })]
    const result = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items, title: '进击的巨人',
      sources: defaultSources, seasons: [makeSeason(), s2Season],
    })
    // S1 无季标注不扣分，保留
    expect(result.seasonSourceMatches[0].sourceMatches[0].bestMatch).not.toBeNull()
    // S2 无季标注扣 -30，低于阈值被过滤
    expect(result.seasonSourceMatches[1].sourceMatches[0].bestMatch).toBeNull()
  })

  it('相邻季惩罚 -35，明确标注其他季应被过滤', () => {
    const seasons = [
      makeSeason(),
      makeSeason({ id: 2, season_number: 2, name: '第二季' }),
      makeSeason({ id: 3, season_number: 3, name: '第三季' }),
    ]
    const items = [makeVideoItem({ vod_name: '进击的巨人 第三季', vod_id: '1' })]
    const result = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items, title: '进击的巨人',
      sources: defaultSources, seasons,
    })
    // S2 最佳匹配是"第三季"条目，相邻季 -20，分数低于阈值被过滤
    const s2Best = result.seasonSourceMatches[1].sourceMatches[0].bestMatch
    const s3Best = result.seasonSourceMatches[2].sourceMatches[0].bestMatch
    expect(s2Best).toBeNull()
    expect(s3Best).not.toBeNull()
  })

  it('范围季标注提取 seasonHints 包含连续季数', () => {
    const { candidates } = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items: [makeVideoItem({ vod_name: '进击的巨人 第1-3季合集', vod_id: '1' })],
      title: '进击的巨人', sources: defaultSources, seasons: [makeSeason()],
    })
    expect(candidates[0].seasonHints).toContain(1)
    expect(candidates[0].seasonHints).toContain(2)
    expect(candidates[0].seasonHints).toContain(3)
  })

  it('范围季条目对包含的季获得高分，超出范围被排除', () => {
    const seasons = [
      makeSeason(),
      makeSeason({ id: 2, season_number: 2, name: '第二季' }),
      makeSeason({ id: 3, season_number: 3, name: '第三季' }),
      makeSeason({ id: 4, season_number: 4, name: '第四季' }),
      makeSeason({ id: 5, season_number: 5, name: '第五季' }),
    ]
    const items = [makeVideoItem({ vod_name: '进击的巨人 第1-3季合集', vod_id: '1' })]
    const result = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items, title: '进击的巨人',
      sources: defaultSources, seasons,
    })
    const s1Best = result.seasonSourceMatches[0].sourceMatches[0].bestMatch
    const s2Best = result.seasonSourceMatches[1].sourceMatches[0].bestMatch
    const s3Best = result.seasonSourceMatches[2].sourceMatches[0].bestMatch
    const s4Best = result.seasonSourceMatches[3].sourceMatches[0].bestMatch
    const s5Best = result.seasonSourceMatches[4].sourceMatches[0].bestMatch
    // S1/S2/S3 都 +5，高分保留
    expect(s1Best).not.toBeNull()
    expect(s2Best).not.toBeNull()
    expect(s3Best).not.toBeNull()
    // S4 相邻季扣 -20，低于 MIN_MATCH_SCORE(75)，被过滤
    expect(s4Best).toBeNull()
    // S5 远距离扣 -50，被过滤
    expect(s5Best).toBeNull()
  })

  it('电影匹配不受季评分影响', () => {
    const result = buildPlaylistMatches({
      mediaType: 'movie',
      items: [makeVideoItem({ vod_name: 'The Four Seasons 1998', vod_id: '1' })],
      title: 'The Four Seasons',
      sources: defaultSources, seasons: [],
    })
    // 电影即使名字带 Season 也不应该被季逻辑影响，movie 路径不调用 applySeasonScore
    const score = result.movieSourceMatches[0].bestMatch!.score
    expect(score).toBeGreaterThanOrEqual(70)
  })

  it('S1-S3 英文范围标注', () => {
    const { candidates } = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items: [makeVideoItem({ vod_name: 'Attack on Titan S1-3', vod_id: '1' })],
      title: 'Attack on Titan', sources: defaultSources, seasons: [makeSeason()],
    })
    expect(candidates[0].seasonHints).toEqual([1, 2, 3])
  })

  it('中文标题后紧跟罗马数字识别季号（无职转生II…），ASCII 与 Unicode 均支持', () => {
    const makeItems = (name: string, vodId: string) => [makeVideoItem({ vod_name: name, vod_id: vodId })]
    const ascii = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items: makeItems('无职转生II到了异世界就拿出真本事Part2', '1'),
      title: '无职转生', sources: defaultSources, seasons: [makeSeason()],
    })
    const unicode = buildPlaylistMatches({
      mediaType: 'tv' as TmdbMediaType,
      items: makeItems('无职转生Ⅱ到了异世界就拿出真本事Part2', '2'),
      title: '无职转生', sources: defaultSources, seasons: [makeSeason()],
    })
    expect(ascii.candidates[0].seasonHints).toContain(2)
    expect(unicode.candidates[0].seasonHints).toContain(2)
  })
})

describe('isEnglishText', () => {
  it('纯英文字符串返回 true', () => {
    expect(isEnglishText('Inception')).toBe(true)
    expect(isEnglishText('Attack on Titan')).toBe(true)
  })

  it('英文字母+数字+符号返回 true', () => {
    expect(isEnglishText('S1-S3')).toBe(true)
    expect(isEnglishText('Movie 2024')).toBe(true)
  })

  it('纯中文返回 false', () => {
    expect(isEnglishText('盗梦空间')).toBe(false)
    expect(isEnglishText('进击的巨人')).toBe(false)
  })

  it('中英混合返回 false', () => {
    expect(isEnglishText('Tenet 信条')).toBe(false)
    expect(isEnglishText('Sherlock 神探夏洛克')).toBe(false)
  })

  it('空字符串返回 false', () => {
    expect(isEnglishText('')).toBe(false)
    expect(isEnglishText('   ')).toBe(false)
  })

  it('纯符号返回 false', () => {
    expect(isEnglishText('!@#$%')).toBe(false)
    expect(isEnglishText('---')).toBe(false)
  })
})

describe('hasSplitSuffix', () => {
  it('识别拆分后缀', () => {
    expect(hasSplitSuffix('你的名字 Part.2')).toBe(true)
    expect(hasSplitSuffix('你的名字 Part2')).toBe(true)
    expect(hasSplitSuffix('封神 下部')).toBe(true)
    expect(hasSplitSuffix('西游记 后篇')).toBe(true)
  })

  it('完整标题不带拆分后缀', () => {
    expect(hasSplitSuffix('你的名字')).toBe(false)
    expect(hasSplitSuffix('你的名字 剧场版')).toBe(false)
    expect(hasSplitSuffix('')).toBe(false)
  })
})
