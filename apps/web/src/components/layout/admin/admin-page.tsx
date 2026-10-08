import type { ReactNode } from 'react';
import { Breadcrumbs, Heading, Text } from '@/components/ui';

interface AdminPageProps {
  /** From the root of the administration to this page. */
  breadcrumbs: readonly { label: string; href?: string }[];
  title: string;
  description?: string;
  /** Actions of the page (filters, export), at the top right. */
  actions?: ReactNode;
  /** Usually a Table (dense), its filters above it. */
  children: ReactNode;
}

/** Page of the administration: breadcrumbs, title, actions, then its table. */
export function AdminPage({ breadcrumbs, title, description, actions, children }: AdminPageProps) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="grid gap-3">
        <Breadcrumbs items={breadcrumbs} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <Heading level={1} size="page">
              {title}
            </Heading>
            {description ? <Text tone="muted">{description}</Text> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
