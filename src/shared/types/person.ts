import type { TmdbMediaType } from './tmdb'

export interface PersonBasic {
  id: number
  name: string
  original_name: string
  profile_path: string | null
  adult: boolean
  known_for_department: string
  gender: number
  popularity: number
}

export interface PersonDetails extends PersonBasic {
  birthday: string | null
  deathday: string | null
  also_known_as: string[]
  biography: string
  place_of_birth: string | null
  imdb_id: string | null
  homepage: string | null
}

export interface PersonImage {
  file_path: string
  width: number
  height: number
  vote_average: number
  vote_count: number
}

export interface PersonImages {
  id: number
  profiles: PersonImage[]
}

/** 单条表演履历（cast 统一格式） */
export interface PersonCastCredit {
  id: number
  mediaType: TmdbMediaType
  title: string
  originalTitle: string
  character: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string
  voteAverage: number
  voteCount: number
  popularity: number
  genreIds: number[]
  originalLanguage: string
  originCountry: string[]
  adult: boolean
  /** TV 专属：参演集数 */
  episodeCount?: number
}

export interface PersonCombinedCredits {
  cast: PersonCastCredit[]
  crew: PersonCastCredit[]
}

/** 作品排序方式 */
export type CreditSortBy = 'release_date' | 'vote_average' | 'popularity' | 'title'

/** 作品筛选 */
export interface CreditFilter {
  mediaType: 'all' | TmdbMediaType
  sortBy: CreditSortBy
  sortOrder: 'asc' | 'desc'
}
