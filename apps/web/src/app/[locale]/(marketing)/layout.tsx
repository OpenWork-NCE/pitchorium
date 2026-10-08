import type { ReactNode } from 'react';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { MarketingShell } from '@/components/layout/shells/marketing-shell';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <ScopedMessages scope="marketing">
      <MarketingShell>{children}</MarketingShell>
    </ScopedMessages>
  );
}
