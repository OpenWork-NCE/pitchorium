'use client';

import type { Locale } from '@pitchorium/contracts';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { ThemeSelector } from '@/components/layout/theme-selector';
import { AnimatedNumber, Reveal, useMotionPreference } from '@/components/motion';
import { Button, Card } from '@/components/ui';

/**
 * Proof of the chain of the provisional home page: every value shown is read at runtime
 * (fonts, theme, page language, active locales from the api, motion preference).
 */
export function Foundations({ activeLocales }: { activeLocales: readonly Locale[] }) {
  const t = useTranslations('web.home');
  const names = useTranslations('web.locale.names');
  const locale = useLocale();
  const format = useFormatter();
  const reduced = useMotionPreference() === 'reduced';
  const formatCount = useCallback((value: number) => format.number(value), [format]);

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
          <AnimatedNumber value={activeLocales.length} format={formatCount} />
        </p>
        <p className="mt-2 text-sm text-muted">{t('locale', { name: names(locale) })}</p>
      </Card>
      <Card>
        <h3 className="text-sm font-medium text-muted">{t('motion')}</h3>
        <p className="mt-3 text-2xl font-semibold">
          {reduced ? t('motionReduced') : t('motionFull')}
        </p>
        <div className="mt-4">
          <Button onClick={() => toast.success(t('checked'))}>{t('check')}</Button>
        </div>
      </Card>
    </Reveal>
  );
}
