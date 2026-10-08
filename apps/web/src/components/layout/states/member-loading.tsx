import { getTranslations } from 'next-intl/server';
import { Loading, Skeleton } from '@/components/ui';
import { ThreeColumnLayout } from '../page-layouts';

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-3" style={{ width: `${92 - index * 14}%` }} />
      ))}
    </div>
  );
}

/**
 * Loading of a page of the member space: skeletons in the three columns the pages use, so that
 * nothing moves when the content arrives (patterns.md). Announced once as busy.
 */
export async function MemberLoading() {
  const layout = await getTranslations('web.layout');
  return (
    <ThreeColumnLayout
      leftLabel={layout('left')}
      rightLabel={layout('right')}
      left={<CardSkeleton lines={2} />}
      right={<CardSkeleton lines={2} />}
    >
      <Loading className="grid gap-4">
        <Skeleton className="h-9 w-1/3" />
        <CardSkeleton />
        <CardSkeleton lines={4} />
      </Loading>
    </ThreeColumnLayout>
  );
}
