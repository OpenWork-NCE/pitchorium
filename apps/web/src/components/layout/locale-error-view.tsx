'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { StatusView } from './status-view';

/**
 * View of an unexpected page error, with a retry. Loaded only once an error occurred
 * (app/[locale]/error.tsx): the boundary is part of every page, its view is not.
 */
export default function LocaleErrorView({
  digest,
  reset,
}: {
  digest: string | undefined;
  reset: () => void;
}) {
  const t = useTranslations('web.error');
  return (
    <StatusView
      title={t('title')}
      body={t('body')}
      reference={digest ? t('reference', { reference: digest }) : undefined}
      actions={
        <>
          <Button onClick={reset}>{t('retry')}</Button>
          <Button variant="outline" asChild>
            <Link href={routes.home}>{t('home')}</Link>
          </Button>
        </>
      }
    />
  );
}
