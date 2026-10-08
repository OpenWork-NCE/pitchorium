'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { Main } from '../page-layouts';
import { StatusView } from '../status-view';

interface ErrorViewProps {
  digest: string | undefined;
  reset: () => void;
  /** Where "back" goes: the home of the group. */
  home: string;
  /** For the groups whose shell lets the page render its `main` (member space). */
  withMain?: boolean;
}

/**
 * View of an unexpected error of a page, with a retry and the reference to quote. Loaded only
 * once an error occurred (the `error.tsx` boundaries, ADR 0094).
 */
export default function ErrorView({ digest, reset, home, withMain = false }: ErrorViewProps) {
  const t = useTranslations('web.error');
  const view = (
    <StatusView
      title={t('title')}
      body={t('body')}
      reference={digest ? t('reference', { reference: digest }) : undefined}
      actions={
        <>
          <Button onClick={reset}>{t('retry')}</Button>
          <Button variant="outline" asChild>
            <Link href={home}>{t('home')}</Link>
          </Button>
        </>
      }
    />
  );
  return withMain ? <Main>{view}</Main> : view;
}
