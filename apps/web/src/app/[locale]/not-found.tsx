import { useTranslations } from 'next-intl';
import { MarketingShell } from '@/components/layout/shells/marketing-shell';
import { StatusView } from '@/components/layout/status-view';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';

/** Localised 404 of every page of a locale (unknown path or `notFound()`). */
export default function LocaleNotFound() {
  const t = useTranslations('web.notFound');
  return (
    <MarketingShell>
      <StatusView
        code={t('code')}
        title={t('title')}
        body={t('body')}
        actions={
          <Button asChild>
            <Link href={routes.home}>{t('home')}</Link>
          </Button>
        }
      />
    </MarketingShell>
  );
}
