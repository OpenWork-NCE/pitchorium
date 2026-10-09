'use client';

import { useTranslations } from 'next-intl';
import { lazy, Suspense } from 'react';
import { Skeleton, ThemeSelector } from '@/components/ui';
import { SettingsSection } from './settings-section';

/** The selects of the language and the time zone load after the page (ADR 0094). */
const LanguageForm = lazy(() =>
  import('./language-form').then((module) => ({ default: module.LanguageForm })),
);

/**
 * Preferences: the language and the time zone of the account (sent to the api), the theme of this
 * device.
 */
export function PreferencesSettings() {
  const t = useTranslations('web.settings.preferences');
  return (
    <div className="grid gap-6">
      <Suspense fallback={<Skeleton className="h-72" />}>
        <LanguageForm />
      </Suspense>
      <SettingsSection id="theme" title={t('themeTitle')} description={t('themeDescription')}>
        <ThemeSelector />
      </SettingsSection>
    </div>
  );
}
