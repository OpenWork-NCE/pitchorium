import type { Locale } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { Reveal } from '@/components/motion';
import { Card, ThemeSelector } from '@/components/ui';
import { LocaleCount, MotionCheck } from './foundation-islands';

/**
 * Proof of the chain of the provisional home page: every value shown is read at runtime
 * (fonts, theme, page language, active locales from the api, motion preference). Rendered on
 * the server; only the interactive values are client islands, hydrated on their own.
 */
export function Foundations({ activeLocales }: { activeLocales: readonly Locale[] }) {
  const t = useTranslations('web.home');
  const names = useTranslations('web.locale.names');
  const locale = useLocale();

  return (
    <Reveal className="mt-10 grid gap-4 md:grid-cols-2">
      <Card>
        <h3 className="text-sm font-medium text-muted">{t('fonts')}</h3>
        <p className="mt-3 font-display text-3xl">{t('fontsValue')}</p>
      </Card>
      <Card>
        <h3 className="text-sm font-medium text-muted">{t('theme')}</h3>
        <div className="mt-4">
          <ThemeSelector />
        </div>
      </Card>
      <Card>
        <h3 className="text-sm font-medium text-muted">{t('activeLocales')}</h3>
        <p className="mt-3 font-display text-5xl text-accent">
          <LocaleCount count={activeLocales.length} />
        </p>
        <p className="mt-2 text-sm text-muted">{t('locale', { name: names(locale) })}</p>
      </Card>
      <Card>
        <h3 className="text-sm font-medium text-muted">{t('motion')}</h3>
        <MotionCheck />
      </Card>
    </Reveal>
  );
}
