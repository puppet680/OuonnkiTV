import { usePwaUpdate } from '@/shared/hooks/usePwaUpdate'

/** 挂载后自动监听 SW 更新，有新版本时弹出刷新 toast */
export function PwaUpdateNotifier() {
  usePwaUpdate()
  return null
}
