interface SearchHistoryItem {
  id: string
  content: string
  /** 搜索类型：影视 / 人物 */
  searchType?: 'media' | 'person'
  createdAt: number
  updatedAt: number
}

type SearchHistory = SearchHistoryItem[]

export type { SearchHistoryItem, SearchHistory }
