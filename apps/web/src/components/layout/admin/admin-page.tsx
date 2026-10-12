import { Eye } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Breadcrumbs, Heading, Text } from '@/components/ui';

interface AdminPageProps {
  /** From the root of the administration to this page. */
  breadcrumbs: readonly { label: string; href?: string }[];
  title: string;
  description?: string;
  /** Actions of the page (filters, export), at the top right. */
  actions?: ReactNode;
  /**
   * The page shows personal data: a permanent mention says that the reading is written to the
   * audit log (the api audits it, ADR 0078, ADR 0172).
   */
  audited?: boolean;
  /** Usually a Table (dense), its filters above it. */
  children: ReactNode;
}

/** The permanent mention of a screen that shows personal data: its reading is audited. */
export async function AuditNotice() {
  const t = await getTranslations('web.admin.common');
  return (
    <p
      className="flex items-start gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm text-muted"
      data-audit-notice
    >
      <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{t('audited')}</span>
    </p>
  );
}

/** Page of the administration: breadcrumbs, title, actions, then its content. */
export function AdminPage({
  breadcrumbs,
  title,
  description,
  actions,
  audited = false,
  children,
}: AdminPageProps) {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-6">
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
        {audited ? <AuditNotice /> : null}
      </div>
      {children}
    </div>
  );
}
