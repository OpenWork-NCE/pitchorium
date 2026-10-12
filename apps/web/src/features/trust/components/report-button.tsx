'use client';

import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, IconButton } from '@/components/ui';
import { type ReportTarget, useReport } from '@/lib/actions/report';

/**
 * « Signaler » beside the actions of a page (an organisation, a project, an event, a mission, an
 * update): opens the dialog of the member shell; nothing for a visitor, who reports illegal
 * content by the public form instead. In a menu, the item calls `useReport` itself.
 */
export function ReportButton({
  target,
  name,
  variant = 'text',
}: {
  target: ReportTarget;
  /** What is reported, for the accessible name of the icon variant. */
  name: string;
  variant?: 'text' | 'icon';
}) {
  const t = useTranslations('web.trust.report');
  const report = useReport();
  if (!report) return null;
  return variant === 'icon' ? (
    <IconButton
      type="button"
      variant="ghost"
      label={t('actionNamed', { name })}
      icon={<Flag />}
      onClick={() => report(target)}
    />
  ) : (
    <Button type="button" variant="ghost" size="sm" onClick={() => report(target)}>
      <Flag aria-hidden />
      {t('action')}
    </Button>
  );
}
