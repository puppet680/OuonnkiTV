import { Link } from 'react-router'
import { User } from 'lucide-react'
import { useTmdbPersonSearch, type TmdbPersonResult } from '@/shared/hooks/useTmdbPersonSearch'
import { useInfiniteScroll } from '@/shared/hooks/useInfiniteScroll'
import { getPosterUrl } from '@/shared/lib/tmdb'
import { buildPersonPath, buildTmdbDetailPath } from '@/shared/lib/routes'
import { Spinner } from '@/shared/components/ui/spinner'
import { StatePanel } from '@/shared/components/StatePanel'

interface SearchPersonSectionProps {
  query: string
}

function PersonCard({ person }: { person: TmdbPersonResult }) {
  const profileUrl = getPosterUrl(person.profilePath, 'w185')

  return (
    <div className="rounded-lg border border-border/60 bg-card/45 p-4">
      <div className="flex items-start gap-4">
        <Link to={buildPersonPath(person.id)} className="shrink-0">
          <div className="border-border/40 bg-muted/30 size-20 overflow-hidden rounded-full border md:size-24">
            {profileUrl ? (
              <img src={profileUrl} alt={person.name} className="size-full object-cover" loading="lazy" />
            ) : (
              <div className="text-muted-foreground flex size-full items-center justify-center">
                <User className="size-8" />
              </div>
            )}
          </div>
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={buildPersonPath(person.id)} className="text-base font-semibold hover:text-primary">
            {person.name}
          </Link>
          {person.knownFor && (
            <p className="text-muted-foreground mt-0.5 text-xs">代表作：{person.knownFor}</p>
          )}
          {person.knownForItems.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {person.knownForItems.slice(0, 3).map(item => (
                <Link
                  key={`${item.mediaType}-${item.id}`}
                  to={buildTmdbDetailPath(item.mediaType, item.id)}
                  className="overflow-hidden rounded-md border border-border/40"
                >
                  {item.posterPath ? (
                    <img
                      src={getPosterUrl(item.posterPath, 'w185')}
                      alt={item.title}
                      className="aspect-[2/3] w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex aspect-[2/3] items-center justify-center text-[10px]">
                      无封面
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SearchPersonSection({ query }: SearchPersonSectionProps) {
  const { results, loading, loadingMore, error, hasMore, loadMore } = useTmdbPersonSearch(query)
  const { sentinelRef } = useInfiniteScroll({ onLoadMore: loadMore, hasMore, isLoading: loadingMore })

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <StatePanel mode="error" title="搜索失败" description={error} />
  }

  if (results.length === 0) {
    return <StatePanel mode="empty" title="未找到" description="未找到相关内容，试试其他关键词" />
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        人物
        <span className="text-muted-foreground ml-2 text-sm font-normal">{results.length} 个结果</span>
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {results.map(person => (
          <PersonCard key={person.id} person={person} />
        ))}
      </div>
      <div ref={sentinelRef} className="flex justify-center py-4">
        {loadingMore && <Spinner />}
      </div>
    </section>
  )
}
