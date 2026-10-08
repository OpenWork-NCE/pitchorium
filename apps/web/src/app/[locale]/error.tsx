'use client';

import { reportError } from '@/lib/observability/report-error';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { StatusView } from '@/components/layout/status-view';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';

/** Unexpected error of a page: reported to Sentry when configured, then a retry. */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('web.error');
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <StatusView
      title={t('title')}
      body={t('body')}
      reference={error.digest ? t('reference', { reference: error.digest }) : undefined}
      actions={
        <>
          <Button onClick={reset}>{t('retry')}</Button>
          <Button variant="secondary" asChild>
            <Link href={routes.home}>{t('home')}</Link>
          </Button>
        </>
      }
    />
  );
}
