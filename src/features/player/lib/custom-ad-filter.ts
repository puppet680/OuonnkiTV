/**
 * 用户自定义去广告脚本管理
 * 脚本格式：function filterAdsFromM3U8(type, m3u8Content) { ... return filteredContent; }
 */

import { useState, useCallback } from 'react'
import { createCustomScriptFilter, type M3u8Filter } from '@ouonnki/cms-core/m3u8'

const STORAGE_KEY = 'oki_custom_ad_filter_code'
const VERSION_KEY = 'oki_custom_ad_filter_version'

export function getCustomAdFilterCode(): string {
  try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}

export function setCustomAdFilterCode(code: string, version: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, code)
    localStorage.setItem(VERSION_KEY, String(version))
  } catch { /* 静默 */ }
}

export function getCustomAdFilterVersion(): number {
  try { return Number(localStorage.getItem(VERSION_KEY)) || 0 } catch { return 0 }
}

/**
 * Hook: 管理自定义去广告脚本
 * 返回编译好的 M3u8Filter（如果代码有效）
 */
export function useCustomAdFilter(sourceKey?: string): {
  filter: M3u8Filter | null
  code: string
  version: number
  error: string | null
  compileError: string | null
  updateCode: (code: string) => void
} {
  const [code, setCode] = useState(getCustomAdFilterCode)
  const [version, setVersion] = useState(getCustomAdFilterVersion)
  const [compileError, setCompileError] = useState<string | null>(null)

  // 尝试编译
  let filter: M3u8Filter | null = null
  let error: string | null = null
  if (code.trim()) {
    filter = createCustomScriptFilter(code, sourceKey)
    if (!filter) {
      error = '脚本编译失败：请确保定义了 filterAdsFromM3U8(type, content) 函数'
    }
  }

  const updateCode = useCallback((newCode: string) => {
    setCode(newCode)
    const newVersion = version + 1
    setVersion(newVersion)
    setCompileError(null)
    setCustomAdFilterCode(newCode, newVersion)
    // 验证编译
    const f = createCustomScriptFilter(newCode, sourceKey)
    if (newCode.trim() && !f) {
      setCompileError('脚本编译失败：请确保定义了 filterAdsFromM3U8(type, content) 函数')
    }
  }, [version, sourceKey])

  return { filter, code, version, error, compileError, updateCode }
}
