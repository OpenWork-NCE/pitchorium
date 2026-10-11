import { useLocale, useTranslations } from 'next-intl';
import { LightShell } from '@/components/layout/shells/light-shell';
import { StatusView } from '@/components/layout/status-view';
import { buttonVariants } from '@/components/ui';

/**
 * Localised 404 of every page of a locale (unknown path or `notFound()`). This boundary is part of
 * the first load of every page of the locale: it adds no client code of its own (plain links, the
 * controls of the header loaded after it, FRONT 7, A2).
 */
export default function LocaleNotFound() {
  const t = useTranslations('web.notFound');
  const locale = useLocale();
  return (
    <LightShell>
      <StatusView
        code={t('code')}
        title={t('title')}
        body={t('body')}
        actions={
          <a href={`/${locale}`} className={buttonVariants()}>
            {t('home')}
          </a>
        }
      />
    </LightShell>
  );
}
