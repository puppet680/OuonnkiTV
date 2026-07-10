import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import { OkiLogo } from '@/shared/components/icons'
import ErrorBoundary from '@/shared/components/ErrorBoundary'
import UpdateModal from '@/shared/components/UpdateModal'
import PwaInstallPrompt from '@/shared/components/PwaInstallPrompt'

// Layouts
import MainLayout from '@/app/layouts/MainLayout'
const SettingsLayout = lazy(() => import('@/app/layouts/SettingsLayout'))

// Auth
const AuthGuard = lazy(() => import('@/shared/components/AuthGuard'))

// Views (lazy loaded from features)
const HomeView = lazy(() => import('@/features/home/views/HomeView'))
const SearchHubView = lazy(() => import('@/features/search/views/SearchHubView'))
const FavoritesView = lazy(() => import('@/features/favorites/views/FavoritesView'))
const HistoryView = lazy(() => import('@/features/history/views/HistoryView'))
const TmdbDetailView = lazy(() => import('@/features/media/views/TmdbDetailView'))
const PersonDetailView = lazy(() => import('@/features/person/views/PersonDetailView'))
const GuideView = lazy(() => import('@/features/guide/views/GuideView'))
const BangumiView = lazy(() => import('@/features/bangumi/views/BangumiView'))

// Settings sub-routes
const SourceSettings = lazy(() => import('@/features/settings/views/SourceSettings'))
const PlaybackSettings = lazy(() => import('@/features/settings/views/PlaybackSettings'))
const SystemSettings = lazy(() => import('@/features/settings/views/SystemSettings'))
const PersonalConfigSettings = lazy(
  () => import('@/features/settings/views/PersonalConfigSettings'),
)
const AboutSettings = lazy(() => import('@/features/settings/views/AboutSettings'))
const PanhubSettings = lazy(() => import('@/features/settings/views/PanhubSettings'))

// Player views
const UnifiedPlayer = lazy(() => import('@/features/player/components/UnifiedPlayer'))

// Loading fallback
const LoadingFallback = () => {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="flex -translate-y-1/2 flex-col items-center justify-center gap-3">
        <OkiLogo size={80} />
        <div className="text-xl font-bold tracking-widest">I TV</div>
        <div className="bg-primary/20 h-1 w-30 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full w-full origin-left"
            style={{
              animation: 'progress-indeterminate 1.5s infinite ease-in-out',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// Suspense wrapper for lazy components
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
)

const router = createBrowserRouter([
  // A. 引导页 (独立布局，无导航栏)
  {
    path: '/guide',
    element: (
      <SuspenseWrapper>
        <GuideView />
      </SuspenseWrapper>
    ),
  },
  // B. 核心布局路由 (带顶部导航)
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <HomeView />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'search',
        element: (
          <SuspenseWrapper>
            <SearchHubView />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'favorites',
        element: (
          <SuspenseWrapper>
            <FavoritesView />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'history',
        element: (
          <SuspenseWrapper>
            <HistoryView />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'bangumi',
        element: (
          <SuspenseWrapper>
            <BangumiView />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'continue-watching',
        element: (
          <SuspenseWrapper>
            <HistoryView />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'media/:type/:tmdbId',
        element: (
          <SuspenseWrapper>
            <TmdbDetailView />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'person/:personId',
        element: (
          <SuspenseWrapper>
            <PersonDetailView />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'play/:type/:tmdbId',
        element: (
          <SuspenseWrapper>
            <UnifiedPlayer />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'play/cms/:sourceCode/:vodId',
        element: (
          <SuspenseWrapper>
            <UnifiedPlayer />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings',
        element: (
          <SuspenseWrapper>
            <SettingsLayout />
          </SuspenseWrapper>
        ),
        children: [
          { index: true, element: <Navigate to="source" replace /> },
          {
            path: 'source',
            element: (
              <SuspenseWrapper>
                <SourceSettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'playback',
            element: (
              <SuspenseWrapper>
                <PlaybackSettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'system',
            element: (
              <SuspenseWrapper>
                <SystemSettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'profile',
            element: (
              <SuspenseWrapper>
                <PersonalConfigSettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'about',
            element: (
              <SuspenseWrapper>
                <AboutSettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'panhub',
            element: (
              <SuspenseWrapper>
                <PanhubSettings />
              </SuspenseWrapper>
            ),
          },
        ],
      },
    ],
  },
])

/**
 * AppRouter - 应用路由入口
 * 使用 createBrowserRouter 实现新路由结构
 */
export default function AppRouter() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <AuthGuard>
          <RouterProvider router={router} />
          <UpdateModal />
          <PwaInstallPrompt />
        </AuthGuard>
      </Suspense>
    </ErrorBoundary>
  )
}
