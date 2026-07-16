import { useSettingStore } from '@/shared/store/settingStore'

/** 获取当前 TMDB 模式是否启用（React hook） */
export function useTmdbEnabled(): boolean {
  return useSettingStore(state => state.system.tmdbEnabled && !state._tmdbDisableOnce)
}

/** 非 hook 场景下获取 TMDB 模式状态 */
export function isTmdbEnabled(): boolean {
  const s = useSettingStore.getState()
  return s.system.tmdbEnabled && !s._tmdbDisableOnce
}
