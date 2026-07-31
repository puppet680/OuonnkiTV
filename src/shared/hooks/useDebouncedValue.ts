import { useEffect, useState } from 'react'

/**
 * 防抖值 hook：value 变化后延迟 delay 毫秒才更新返回值
 * 替代手写 debounceTimerRef + setTimeout 的散落写法（搜索建议等场景）
 * @param value - 需要防抖的原始值
 * @param delay - 防抖延迟毫秒数，默认 100（与存量 useSearchSuggestions 行为一致）
 * @returns 防抖后的值
 */
export function useDebouncedValue<T>(value: T, delay = 100): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
