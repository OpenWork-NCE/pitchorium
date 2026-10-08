import type { ReactNode } from 'react';
import { BrandSymbol } from '@/components/brand';
import { cn } from '@/lib/cn';
import { MOTIF } from './shells/parts';

interface StatusViewProps {
  code?: string;
  title: string;
  body: string;
  /** Technical reference to quote to the support (error digest, request id). */
  reference?: ReactNode;
  actions: ReactNode;
}

/** Shared page of the not-found and error states, on the brand motif. */
export function StatusView({ code, title, body, reference, actions }: StatusViewProps) {
  return (
    <div className={cn('flex min-h-[70dvh] items-center', MOTIF)}>
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-xl">
          <BrandSymbol animated />
          {code ? (
            <p className="mt-8 font-display text-5xl font-extrabold text-accent">{code}</p>
          ) : null}
          <h1 className="mt-4 text-3xl">{title}</h1>
          <p className="mt-4 text-lg text-muted">{body}</p>
          {reference ? <p className="mt-4 font-mono text-xs text-muted">{reference}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
        </div>
      </div>
    </div>
  );
}
