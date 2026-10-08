import { Card, Skeleton } from '@/components/ui';

/** A publication while it loads: the shape of PostCard, so that nothing moves when it arrives. */
export function PostSkeleton() {
  return (
    <Card padding="none" className="grid gap-3 p-4 sm:p-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-3/4" />
    </Card>
  );
}
