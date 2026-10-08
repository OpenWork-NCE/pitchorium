import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { DataProvider } from '@/components/layout/data-provider';
import { MarketingShell } from '@/components/layout/shells/marketing-shell';

/** Development tools: they do not exist in a production build. */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <DataProvider>
      <MarketingShell>{children}</MarketingShell>
    </DataProvider>
  );
}
