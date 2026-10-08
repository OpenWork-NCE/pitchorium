import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Main content of a page: the target of the skip link (`#main`), focused after a navigation
 * (RouteFocus). Every page of the member space and the administration renders one.
 */
export function Main({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main id="main" tabIndex={-1} className={cn('min-w-0 outline-none', className)}>
      {children}
    </main>
  );
}

interface ThreeColumnLayoutProps {
  /** Content of the page, first in the document order. */
  children: ReactNode;
  /** Left column on a wide screen (suggestions, §6.1). */
  left?: ReactNode;
  /** Right column on a wide screen (projects and people to follow). */
  right?: ReactNode;
  /** Accessible names of the side columns (complementary landmarks). */
  leftLabel: string;
  rightLabel: string;
}

/**
 * Three columns of the member space (docs/design/direction.md): 3, 6 and 3 columns from 1280 px,
 * the content and one side column of 4 from 1024 px, one column below. The side columns stick
 * under the header; the content comes first in the document at every size.
 */
export function ThreeColumnLayout({
  children,
  left,
  right,
  leftLabel,
  rightLabel,
}: ThreeColumnLayoutProps) {
  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:py-8">
      <Main className="lg:col-span-8 xl:col-span-6 xl:col-start-4 xl:row-start-1">{children}</Main>
      <div className="grid content-start gap-6 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:col-span-4 lg:self-start xl:contents">
        {left ? (
          <aside
            aria-label={leftLabel}
            className="grid content-start gap-4 xl:sticky xl:top-[calc(var(--header-height)+1.5rem)] xl:col-span-3 xl:col-start-1 xl:row-start-1 xl:self-start"
          >
            {left}
          </aside>
        ) : null}
        {right ? (
          <aside
            aria-label={rightLabel}
            className="grid content-start gap-4 xl:sticky xl:top-[calc(var(--header-height)+1.5rem)] xl:col-span-3 xl:col-start-10 xl:row-start-1 xl:self-start"
          >
            {right}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** One column of content: `page` for rich pages (1 024 px), `prose` for reading (direction.md). */
export function SingleColumnLayout({
  children,
  width = 'page',
}: {
  children: ReactNode;
  width?: 'page' | 'prose';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-6 sm:px-6 lg:py-8',
        width === 'page' ? 'max-w-5xl' : 'max-w-[42.5rem]',
      )}
    >
      <Main>{children}</Main>
    </div>
  );
}
