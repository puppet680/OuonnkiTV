import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { Search, X, History, Trash2, Film, User, Globe, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverAnchor } from '@/shared/components/ui/popover'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { useSearchHistory } from '@/shared/hooks'
import type { SearchMode } from './SearchModeToggle'
import type { TmdbMediaItem } from '@/shared/types/tmdb'

export type SearchType = 'media' | 'person'

const HINT_PLACEHOLDER = '使用 y:年份 筛选，如"星球大战 y:1977"'

const SEARCH_TYPE_OPTIONS: { value: SearchType; label: string; icon: React.ReactNode }[] = [
  { value: 'media', label: '影视', icon: <Film className="size-3.5" /> },
  { value: 'person', label: '人物', icon: <User className="size-3.5" /> },
]

const DIRECT_TYPE_OPTIONS: { value: SearchType; label: string; icon: React.ReactNode }[] = [
  { value: 'media', label: '综合', icon: <Globe className="size-3.5" /> },
]

interface SearchHubInputProps {
  initialQuery: string
  initialSearchType: SearchType
  onSearch: (query: string, searchType: SearchType) => void
  onClear?: () => void
  searchMode?: SearchMode
  trending?: TmdbMediaItem[]
  className?: string
}

export const SearchHubInput = memo(function SearchHubInput({
  initialQuery,
  initialSearchType,
  onSearch,
  onClear,
  searchMode,
  trending = [],
  className,
}: SearchHubInputProps) {
  const isDirect = searchMode === 'direct'
  const typeOptions = isDirect ? DIRECT_TYPE_OPTIONS : SEARCH_TYPE_OPTIONS

  // 动态 placeholder：热映按顺序，提示随机穿插
  const placeholders = useMemo(() => {
    if (trending.length === 0) return [HINT_PLACEHOLDER]
    const trendingTitles = trending.slice(0, 8).map(t => `大家都在搜：${t.title}`)
    const result: string[] = []
    for (let i = 0; i < trendingTitles.length; i++) {
      result.push(trendingTitles[i])
      // 每 1~3 条热映后随机穿插一次提示
      if ((i + 1) % (Math.floor(Math.random() * 3) + 1) === 0) {
        result.push(HINT_PLACEHOLDER)
      }
    }
    return result
  }, [trending])
  const [inputValue, setInputValue] = useState(initialQuery)
  const [searchType, setSearchType] = useState<SearchType>(initialSearchType)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { searchHistory, removeSearchHistoryItem } = useSearchHistory()

  const typeBtnRef = useRef<HTMLButtonElement>(null)

  // close type menu on outside click
  useEffect(() => {
    if (!typeMenuOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (typeBtnRef.current?.contains(target)) return
      // check if click is inside the dropdown
      if (target.closest('[data-type-menu]')) return
      setTypeMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [typeMenuOpen])

  // rotating placeholder
  useEffect(() => {
    const timer = setInterval(() => setPlaceholderIdx(i => {
      if (placeholders.length <= 1) return 0
      let next: number
      do { next = Math.floor(Math.random() * placeholders.length) } while (next === i)
      return next
    }), 4000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => { setInputValue(initialQuery) }, [initialQuery])
  useEffect(() => {
    // 直连模式下强制 media
    setSearchType(isDirect ? 'media' : initialSearchType)
  }, [initialSearchType, isDirect])

  useEffect(() => {
    return () => { if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current) }
  }, [])

  const handleSearch = useCallback((q: string, typeOverride?: SearchType) => {
    const trimmed = q.trim()
    if (!trimmed) return
    const type = typeOverride || searchType
    if (typeOverride) setSearchType(typeOverride)
    setInputValue(trimmed)
    setIsDropdownOpen(false)
    onSearch(trimmed, type)
  }, [onSearch, searchType])

  const handleInputChange = (value: string) => {
    setInputValue(value)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') { handleSearch(inputValue) }
    if (event.key === 'Escape') { setIsDropdownOpen(false); inputRef.current?.blur() }
  }

  const handleFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    setIsDropdownOpen(true)
  }

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => { setIsDropdownOpen(false) }, 200)
  }

  const handleClear = () => {
    setInputValue('')
    onClear?.()
    inputRef.current?.focus()
  }

  const hasContent = inputValue.trim().length > 0
  const hasHistory = searchHistory.length > 0
  // 搜索页不需要实时建议，只在无输入时显示历史
  const shouldShowDropdown = isDropdownOpen && !hasContent && hasHistory

  const currentTypeLookup = typeOptions.find(o => o.value === searchType)
  const currentType = currentTypeLookup || typeOptions[0]
  const reducedMotion = useReducedMotion()

  return (
    <div className={`w-full max-w-3xl ${className}`}>
      <Popover open={shouldShowDropdown}>
        <PopoverAnchor asChild>
          <div className="relative flex w-full">
            {/* type selector */}
            <div className="relative">
              <button
                ref={typeBtnRef}
                type="button"
                className="flex h-11 items-center gap-1 rounded-full rounded-r-none border border-input bg-transparent pl-3 pr-2 text-sm font-medium hover:bg-accent/50 transition-colors"
                onClick={(e) => { e.stopPropagation(); setTypeMenuOpen(prev => !prev) }}
              >
                {currentType.icon}
                {currentType.label}
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
              {typeMenuOpen && (
                <div data-type-menu className="absolute top-full left-0 z-50 mt-1 w-24 rounded-lg border border-border bg-popover p-1 shadow-md">
                  {typeOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${opt.value === searchType ? 'text-primary font-medium' : ''}`}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setSearchType(opt.value); setTypeMenuOpen(false); inputRef.current?.focus() }}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* input */}
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                placeholder=""
                className="h-11 w-full rounded-none border-x-0 pr-8 text-base focus-visible:ring-0"
                value={inputValue}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              {!inputValue && (
                <AnimatePresence mode="wait">
                  <motion.span
                    key={placeholderIdx}
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.25 }}
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 truncate text-base select-none"
                  >
                    {placeholders[placeholderIdx]}
                  </motion.span>
                </AnimatePresence>
              )}
            </div>
            {inputValue.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-24 -translate-y-1/2 transition-colors"
              >
                <X size={16} />
              </button>
            )}
            <Button
              disabled={inputValue.length === 0}
              className="dark:bg-accent dark:hover:bg-accent/80 h-11 w-20 rounded-full rounded-l-none bg-gray-200 hover:bg-gray-300"
              onClick={() => handleSearch(inputValue)}
            >
              <Search className="text-primary" size={20} />
            </Button>
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          sideOffset={8}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <div className="p-1">
            <ScrollArea className="max-h-80 px-3">
              <div>
                <div className="text-muted-foreground px-3 py-2 text-xs font-medium">最近搜索</div>
                {searchHistory.map(item => (
                  <div
                    key={item.id}
                    className="hover:bg-accent group flex cursor-pointer items-center rounded-lg px-3 py-2 transition-colors"
                    onClick={() => handleSearch(item.content, item.searchType as SearchType)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSearch(item.content, item.searchType as SearchType) } }}
                  >
                    <History className="text-muted-foreground mr-3 size-4 shrink-0" />
                    <span className="flex-1 truncate">{item.content}</span>
                    {item.searchType && (
                      <span className="text-muted-foreground ml-2 shrink-0 text-[10px]">
                        {item.searchType === 'person' ? '人物' : '影视'}
                      </span>
                    )}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0 p-1 opacity-0 transition-colors group-hover:opacity-100"
                      onMouseDown={e => e.preventDefault()}
                      onClick={e => { e.stopPropagation(); removeSearchHistoryItem(item.id) }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
})
