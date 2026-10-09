'use client';

import { useTranslations } from 'next-intl';
import { lazy, Suspense } from 'react';
import { FieldSkeleton, ThemeSelector } from '@/components/ui';
import { SettingsSection } from './settings-section';

/** The selects of the language and the time zone load after the page (ADR 0094). */
const LanguageForm = lazy(() =>
  import('./language-form').then((module) => ({ default: module.LanguageForm })),
);

/** The form of the language and the time zone while it loads: its card and two fields. */
function LanguageFormPlaceholder() {
  const t = useTranslations('web.settings.preferences');
  return (
    <SettingsSection id="language" title={t('title')} description={t('description')}>
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{t('language')}</span>
          <FieldSkeleton />
        </div>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{t('timeZone')}</span>
          <FieldSkeleton />
        </div>
      </div>
    </SettingsSection>
  );
}

/**
 * Preferences: the language and the time zone of the account (sent to the api), the theme of this
 * device.
 */
export function PreferencesSettings() {
  const t = useTranslations('web.settings.preferences');
  return (
    <div className="grid gap-6 *:min-w-0">
      <Suspense fallback={<LanguageFormPlaceholder />}>
        <LanguageForm />
      </Suspense>
      <SettingsSection id="theme" title={t('themeTitle')} description={t('themeDescription')}>
        <ThemeSelector />
      </SettingsSection>
    </div>
  );
}
