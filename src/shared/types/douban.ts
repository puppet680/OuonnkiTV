export interface DoubanComment {
  username: string
  user_id: string
  avatar: string
  rating: number // 0-5, 0 = no rating
  time: string
  location: string
  content: string
  useful_count: number
}

export interface DoubanSubject {
  id: string
  title: string
  year: string
  rating: string
  type: 'movie' | 'tv'
}

export interface DoubanSearchResult {
  subjects: DoubanSubject[]
}

export interface DoubanCommentsResult {
  code: number
  message: string
  data?: {
    comments: DoubanComment[]
    start: number
    limit: number
    count: number
    total?: number
  }
}
