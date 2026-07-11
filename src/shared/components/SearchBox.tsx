import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Search, X, ArrowLeft, History, Trash2, Film, User, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverAnchor } from '@/shared/components/ui/popover'
import { useSearch, useSearchHistory, useSearchSuggestions } from '@/shared/hooks'
import { useSearchStore } from '@/shared/store/searchStore'
import { useTmdbStore } from '@/shared/store/tmdbStore'
import { useTmdbEnabled } from '@/shared/hooks/useTmdbMode'
import { ScrollArea } from '@/shared/components/ui/scroll-area'

const MotionButton = motion.create(Button)

const HINT_PLACEHOLDER = '使用 y:年份 筛选，如"星球大战 y:1977"'

export type NavSearchType = 'media' | 'person'

const TYPE_OPTIONS: { value: NavSearchType; label: string; icon: React.ReactNode }[] = [
  { value: 'media', label: '影视', icon: <Film className="size-3.5" /> },
  { value: 'person', label: '人物', icon: <User className="size-3.5" /> },
]

interface SearchBoxProps {
  onMobileSearchChange?: (isOpen: boolean) => void
}

export default function SearchBox({ onMobileSearchChange }: SearchBoxProps) {
  const { search: searchQuery, searchMovie } = useSearch()
  const { searchHistory, removeSearchHistoryItem } = useSearchHistory()
  const { suggestions, isLoading, fetchSuggestions, clearSuggestions } = useSearchSuggestions()
  const reducedMotion = useReducedMotion()
  const tmdbEnabled = useTmdbEnabled()
  const typeOptions = tmdbEnabled ? TYPE_OPTIONS : [{ value: 'media' as NavSearchType, label: '综合', icon: <Film className="size-3.5" /> }]

  const [inputContent, setInputContent] = useState('')
  const lastSearchType = useSearchStore(s => s.lastSearchType)
  const setLastSearchType = useSearchStore(s => s.setLastSearchType)
  const [searchType, setSearchType] = useState<NavSearchType>(() => {
    if (!tmdbEnabled) return 'media'
    return (lastSearchType as NavSearchType) || 'media'
  })
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const trending = useTmdbStore(s => s.trending)

  const placeholders = useMemo(() => {
    if (trending.length === 0) return [HINT_PLACEHOLDER]
    const titles = trending.slice(0, 8).map(t => `大家都在搜：${t.title}`)
    const result: string[] = []
    for (let i = 0; i < titles.length; i++) {
      result.push(titles[i])
      if ((i + 1) % (Math.floor(Math.random() * 3) + 1) === 0) result.push(HINT_PLACEHOLDER)
    }
    return result
  }, [trending])

  // rotating placeholder
  useEffect(() => {
    if (placeholders.length <= 1) return
    const timer = setInterval(() => setPlaceholderIdx(i => {
      let next: number
      do { next = Math.floor(Math.random() * placeholders.length) } while (next === i)
      return next
    }), 4000)
    return () => clearInterval(timer)
  }, [placeholders.length])

  const mobileInputRef = useRef<HTMLInputElement>(null)
  const desktopInputRef = useRef<HTMLInputElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMobileSearchChangeRef = useRef(onMobileSearchChange)
  const typeBtnRef = useRef<HTMLButtonElement>(null)
  onMobileSearchChangeRef.current = onMobileSearchChange

  // close type menu on outside click
  useEffect(() => {
    if (!typeMenuOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (typeBtnRef.current?.contains(target)) return
      if (target.closest('[data-nav-type-menu]')) return
      setTypeMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [typeMenuOpen])

  const hasContent = inputContent.trim().length > 0
  const hasHistory = searchHistory.length > 0
  const hasSuggestions = suggestions.length > 0
  const shouldShowDropdown = isDropdownOpen && (hasContent ? hasSuggestions || isLoading : hasHistory)

  const handleInteractiveItemKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, action: () => void) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    action()
  }

  const doSearch = useCallback((query: string) => {
    searchMovie(query, true, searchType)
    setIsDropdownOpen(false)
  }, [searchMovie, searchType])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      doSearch(inputContent)
      if (isMobileSearchOpen) closeMobileSearch()
    }
    if (event.key === 'Escape') {
      setIsDropdownOpen(false)
      if (isMobileSearchOpen) closeMobileSearch()
    }
  }

  const handleClear = () => {
    setInputContent('')
    clearSuggestions()
  }

  const handleInputChange = (value: string) => {
    setInputContent(value)
    if (value.trim()) fetchSuggestions(value, searchType)
    else clearSuggestions()
  }

  const handleFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    setIsDropdownOpen(true)
  }

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => setIsDropdownOpen(false), 200)
  }

  const handleHistoryItemClick = useCallback((content: string, type?: string) => {
    setInputContent(content)
    if (type) { setSearchType(type as NavSearchType); setLastSearchType(type) }
    searchMovie(content, true, type)
    setIsDropdownOpen(false)
  }, [searchMovie, setLastSearchType])

  const handleHistoryItemDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeSearchHistoryItem(id)
  }, [removeSearchHistoryItem])

  const handleSuggestionClick = useCallback((title: string) => {
    setInputContent(title)
    doSearch(title)
  }, [doSearch])

  const openMobileSearch = () => {
    setIsMobileSearchOpen(true)
    onMobileSearchChange?.(true)
    setTimeout(() => mobileInputRef.current?.focus(), 100)
  }

  const closeMobileSearch = () => {
    setIsMobileSearchOpen(false)
    setIsDropdownOpen(false)
    onMobileSearchChange?.(false)
  }

  useEffect(() => { setInputContent(searchQuery) }, [searchQuery])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
      onMobileSearchChangeRef.current?.(false)
    }
  }, [])

  const currentType = typeOptions.find(o => o.value === searchType)!

  // ---- shared sub-renders ----

  const hasMultipleTypes = typeOptions.length > 1
  const TypeMenu = typeMenuOpen && hasMultipleTypes && (
    <div data-nav-type-menu className="absolute top-full left-0 z-50 mt-1 w-22 rounded-lg border border-border bg-popover p-1 shadow-md">
      {typeOptions.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent ${opt.value === searchType ? 'text-primary font-medium' : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setSearchType(opt.value); setLastSearchType(opt.value); setTypeMenuOpen(false) }}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )


  const DropdownContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="p-1">
      <ScrollArea className="max-h-100 px-3">
        {!hasContent ? (
          <div>
            <div className="text-muted-foreground px-3 py-2 text-xs font-medium">最近搜索</div>
            {searchHistory.map(item => (
              <div
                key={item.id}
                className="hover:bg-accent group flex cursor-pointer items-center rounded-lg px-3 py-2 transition-colors"
                onClick={() => handleHistoryItemClick(item.content, item.searchType)}
                role="button"
                tabIndex={0}
                onKeyDown={e => handleInteractiveItemKeyDown(e, () => handleHistoryItemClick(item.content, item.searchType))}
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
                  className={`text-muted-foreground hover:text-destructive shrink-0 p-1 transition-colors ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  onMouseDown={e => e.preventDefault()}
                  onKeyDown={e => e.stopPropagation()}
                  onClick={e => handleHistoryItemDelete(e, item.id)}
                  aria-label={`删除: ${item.content}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {isLoading ? (
              <div className="text-muted-foreground px-3 py-4 text-center text-sm">搜索中...</div>
            ) : (
              suggestions.map(item => (
                <div
                  key={`${item.mediaType}-${item.id}`}
                  className="hover:bg-accent flex cursor-pointer items-center rounded-lg px-3 py-2 transition-colors"
                  onClick={() => handleSuggestionClick(item.title)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => handleInteractiveItemKeyDown(e, () => handleSuggestionClick(item.title))}
                >
                  <Search className="text-muted-foreground mr-3 size-4 shrink-0" />
                  <span className="flex-1 truncate">{item.title}</span>
                  <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                    {item.mediaType === 'movie' ? '电影' : (item.mediaType as string) === 'person' ? '人物' : '剧集'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )

  return (
    <>
      {/* 移动端返回按钮 */}
      <div className={`absolute left-2 transition-all duration-300 ease-out motion-reduce:transition-none sm:hidden ${
        isMobileSearchOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-4 opacity-0'
      }`}>
        <Button size="icon" variant="ghost" className="size-9" onClick={closeMobileSearch} aria-label="关闭搜索">
          <ArrowLeft className="text-primary" size={20} />
        </Button>
      </div>

      <div className="flex flex-auto items-center">
        {/* ======== 桌面端 ======== */}
        <Popover open={shouldShowDropdown && !isMobileSearchOpen}>
          <PopoverAnchor asChild>
            <div className="relative hidden w-full sm:flex">
              {/* 桌面端类型选择：带标签 */}
              <div className="relative">
                <button
                  ref={typeBtnRef}
                  type="button"
                  className="flex h-9 items-center gap-0.5 rounded-full rounded-r-none border border-input bg-transparent pl-2.5 pr-1.5 text-sm font-medium hover:bg-accent/50 transition-colors"
                  onClick={(e) => { e.stopPropagation(); if (hasMultipleTypes) setTypeMenuOpen(prev => !prev) }}
                >
                  {currentType.icon}
                  <span>{currentType.label}</span>
                  {hasMultipleTypes && <ChevronDown className="size-2.5 text-muted-foreground" />}
                </button>
                {TypeMenu}
              </div>

              <div className="relative flex-1">
                <Input
                  ref={desktopInputRef}
                  placeholder=""
                  className="h-9 w-full rounded-none border-x-0 pr-8 pl-3 focus-visible:ring-0"
                  value={inputContent}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                {!inputContent && placeholders.length > 0 && (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={placeholderIdx}
                      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
                      className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center truncate text-sm select-none"
                    >
                      {placeholders[placeholderIdx]}
                    </motion.span>
                  </AnimatePresence>
                )}
              </div>
              {inputContent.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-[88px] -translate-y-1/2 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
              <Button
                disabled={inputContent.length === 0}
                className="dark:bg-accent dark:hover:bg-accent h-9 w-20 rounded-full rounded-l-none bg-gray-200 hover:bg-gray-300"
                onClick={() => doSearch(inputContent)}
                aria-label="搜索"
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
            <DropdownContent />
          </PopoverContent>
        </Popover>

        {/* ======== 移动端展开 ======== */}
        <Popover open={shouldShowDropdown && isMobileSearchOpen}>
          <PopoverAnchor asChild>
            <div className={`absolute right-4 left-12 transition-all duration-300 ease-out motion-reduce:transition-none sm:hidden ${
              isMobileSearchOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
            }`}>
              <div className="relative flex w-full">
                <div className="relative">
                  <button
                    ref={typeBtnRef}
                    type="button"
                    className="flex h-9 items-center gap-0.5 rounded-full rounded-r-none border border-input bg-transparent pl-2.5 pr-1.5 text-sm font-medium hover:bg-accent/50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); if (hasMultipleTypes) setTypeMenuOpen(prev => !prev) }}
                  >
                    {currentType.icon}
                    {hasMultipleTypes && <ChevronDown className="size-2.5 text-muted-foreground" />}
                  </button>
                  {TypeMenu}
                </div>
                <div className="relative flex-1">
                  <Input
                    ref={mobileInputRef}
                    placeholder=""
                    className="h-9 w-full rounded-none border-x-0 pr-8 pl-3 focus-visible:ring-0"
                    value={inputContent}
                    onChange={e => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  {!inputContent && placeholders.length > 0 && (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={placeholderIdx}
                        initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                        transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
                        className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center truncate text-sm select-none"
                      >
                        {placeholders[placeholderIdx]}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </div>
                {inputContent.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-[58px] z-10 -translate-y-1/2 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
                <MotionButton
                  disabled={inputContent.length === 0}
                  className="dark:bg-accent dark:hover:bg-accent h-9 w-12 rounded-full rounded-l-none bg-gray-200 hover:bg-gray-300"
                  onClick={() => { doSearch(inputContent); closeMobileSearch() }}
                  layout={!reducedMotion || undefined}
                  aria-label="搜索"
                >
                  {isMobileSearchOpen && (
                    reducedMotion ? (
                      <Search className="text-primary" size={18} />
                    ) : (
                      <motion.span layoutId="mobile-search-icon">
                        <Search className="text-primary" size={18} />
                      </motion.span>
                    )
                  )}
                </MotionButton>
              </div>
            </div>
          </PopoverAnchor>
          <PopoverContent
            className="w-[calc(100vw-64px)] p-0"
            align="start"
            sideOffset={8}
            onOpenAutoFocus={e => e.preventDefault()}
          >
            <DropdownContent isMobile />
          </PopoverContent>
        </Popover>
      </div>

      {/* ======== 移动端触发按钮 ======== */}
      <MotionButton
        size="icon"
        variant="ghost"
        className="size-7 sm:hidden"
        onClick={openMobileSearch}
        layout={!reducedMotion || undefined}
        aria-label="打开搜索"
      >
        {!isMobileSearchOpen && (
          reducedMotion ? (
            <Search className="text-primary" size={20} />
          ) : (
            <motion.span layoutId="mobile-search-icon">
              <Search className="text-primary" size={20} />
            </motion.span>
          )
        )}
      </MotionButton>

      <input type="hidden" data-mobile-search-open={isMobileSearchOpen} />
    </>
  )
}
