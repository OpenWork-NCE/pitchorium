import { PageLoading } from '@/components/layout/page-loading';

/**
 * An editorial page still streaming: the loading bar, and a screen of space so that the footer
 * waits below the fold. The content then takes its place without moving what was seen (CLS).
 */
export default function Loading() {
  return (
    <div className="min-h-dvh">
      <PageLoading />
    </div>
  );
}
