import { Skeleton } from '@/shared/components/ui/skeleton'

export function PersonDetailSkeleton() {
  return (
    <div className="space-y-8 px-1 pb-8 md:px-2 [&_[data-slot=skeleton]]:bg-zinc-200 [&_[data-slot=skeleton]]:ring-1 [&_[data-slot=skeleton]]:ring-zinc-300/70 dark:[&_[data-slot=skeleton]]:bg-zinc-700/45 dark:[&_[data-slot=skeleton]]:ring-zinc-600/40">
      {/* Hero skeleton */}
      <section className="relative overflow-hidden rounded-lg bg-zinc-200/40 dark:bg-zinc-800/40">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-6 sm:p-6 md:p-8">
          <Skeleton className="mx-auto size-28 shrink-0 rounded-full sm:mx-0 sm:size-36 md:size-44" />
          <div className="min-w-0 flex-1 space-y-3 pt-2">
            <Skeleton className="mx-auto h-8 w-48 sm:mx-0 md:h-9 md:w-64" />
            <Skeleton className="mx-auto h-4 w-32 sm:mx-0" />
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </div>
        </div>
      </section>

      {/* Known works skeleton */}
      <section className="space-y-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[140px] shrink-0 space-y-2 sm:w-[160px]">
              <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </section>

      {/* Credits skeleton */}
      <section className="space-y-4">
        <Skeleton className="h-6 w-20" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-border/45 p-3">
              <Skeleton className="aspect-[2/3] w-20 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
