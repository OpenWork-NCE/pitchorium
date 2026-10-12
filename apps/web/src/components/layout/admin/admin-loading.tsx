import { Loading, Skeleton } from '@/components/ui';
import { PageLoading } from '../page-loading';

/**
 * Pending screen of the console: the bar of a navigation, then the shape of an AdminPage (its
 * breadcrumbs, title and description, a line of filters, the dense rows of a table), so the
 * content lands where its skeleton stood. Still with less motion (`.skeleton`).
 */
export function AdminLoading() {
  return (
    <>
      <PageLoading />
      <Loading className="mx-auto grid w-full max-w-6xl gap-6">
        <div className="grid gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-10 rounded-none" />
          ))}
        </div>
      </Loading>
    </>
  );
}
