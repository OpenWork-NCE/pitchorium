import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { Main } from '../page-layouts';
import { StatusView } from '../status-view';

/**
 * Page of a route group that does not exist for this reader (`notFound()`): where to go back.
 * `withMain` for the groups whose shell lets the page render its `main` (member space).
 */
export async function NotFoundView({
  home,
  withMain = false,
}: {
  home: string;
  withMain?: boolean;
}) {
  const t = await getTranslations('web.notFound');
  const view = (
    <StatusView
      code={t('code')}
      title={t('title')}
      body={t('body')}
      actions={
        <Button asChild>
          <Link href={home}>{t('home')}</Link>
        </Button>
      }
    />
  );
  return withMain ? <Main>{view}</Main> : view;
}
