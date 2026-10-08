import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Container } from '../container';
import { SiteHeader } from '../site-header';
import { Main, MOTIF } from './parts';

/** Sign-in, sign-up, verification, reset and onboarding: one column over the brand motif. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={cn('flex min-h-dvh flex-col', MOTIF)}>
      <SiteHeader />
      <Main>
        <Container className="flex justify-center py-12 md:py-20">
          <div className="w-full max-w-md">{children}</div>
        </Container>
      </Main>
    </div>
  );
}
