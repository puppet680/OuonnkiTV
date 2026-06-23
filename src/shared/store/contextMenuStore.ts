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
  registerItems: (items: ContextMenuItem[]) => string[]  // 返回注册的 id 列表
  unregisterItems: (...ids: string[]) => void
}

export const useGlobalContextMenuStore = create<ContextMenuState>()((set) => ({
  items: [],
  registerItems: (items) => {
    set((s) => ({ items: [...s.items, ...items] }))
    return items.map((i) => i.id)
  },
  unregisterItems: (...ids) => {
    const idSet = new Set(ids)
    set((s) => ({ items: s.items.filter((i) => !idSet.has(i.id)) }))
  },
}))
