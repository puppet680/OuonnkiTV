import { createApp, createRouter, toNodeListener } from 'h3'
import { doubanSearchHandler, doubanCommentsHandler } from './api'

const router = createRouter()
router.get('/search', doubanSearchHandler)
router.get('/comments', doubanCommentsHandler)

const doubanApp = createApp()
doubanApp.use(router)

export function createDoubanListener() {
  return toNodeListener(doubanApp)
}
