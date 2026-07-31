import { create } from 'zustand'
import type { ReactNode } from 'react'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

interface ContextMenuState {
  items: ContextMenuItem[]
  /** 菜单标题（如播放页视频名），供移动端抽屉显示 */
  menuTitle: string
  setMenuTitle: (title: string) => void
  registerItems: (items: ContextMenuItem[]) => string[]  // 返回注册的 id 列表
  unregisterItems: (...ids: string[]) => void
}

export const useGlobalContextMenuStore = create<ContextMenuState>()((set) => ({
  items: [],
  menuTitle: '',
  setMenuTitle: (menuTitle) => set({ menuTitle }),
  registerItems: (items) => {
    set((s) => ({ items: [...s.items, ...items] }))
    return items.map((i) => i.id)
  },
  unregisterItems: (...ids) => {
    const idSet = new Set(ids)
    set((s) => {
      const items = s.items.filter((i) => !idSet.has(i.id))
      // 菜单项清空时一并清掉标题，避免残留上次页面的标题
      return { items, menuTitle: items.length === 0 ? '' : s.menuTitle }
    })
  },
}))
