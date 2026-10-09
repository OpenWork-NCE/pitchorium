'use client';

import { accountControllerUpdatePreferences } from '@pitchorium/api-client';
import type { Locale } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, FormActions, Select, TimeZoneSelect } from '@/components/ui';
import { usePathname } from '@/i18n/navigation';
import { useCurrentMember } from '../current-member';
import { SettingsSection } from './settings-section';

/**
 * Language of the account (active locales only, §8.3) and time zone of the dates and digests
 * (ADR 0061), sent to the api; the page then reloads in the language chosen.
 */
export function LanguageForm() {
  const t = useTranslations('web.settings.preferences');
  const names = useTranslations('web.locale.names');
  const member = useCurrentMember();
  const current = useLocale();
  const pathname = usePathname();
  const [locale, setLocale] = useState<Locale>(member.preferences.locale);
  const [timeZone, setTimeZone] = useState(member.preferences.timeZone);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  async function save() {
    setState('saving');
    try {
      await accountControllerUpdatePreferences({ locale, timeZone });
      if (locale !== current) {
        window.location.assign(new URL(`/${locale}${pathname}`, window.location.origin));
        return;
      }
      setState('saved');
    } catch {
      setState('failed');
    }
  }

  return (
    <SettingsSection id="language" title={t('title')} description={t('description')}>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="preferences-locale" className="text-sm font-medium">
            {t('language')}
          </label>
          <Select
            id="preferences-locale"
            value={locale}
            onValueChange={setLocale}
            options={member.activeLocales.map((code) => ({ value: code, label: names(code) }))}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="preferences-time-zone" className="text-sm font-medium">
            {t('timeZone')}
          </label>
          <TimeZoneSelect id="preferences-time-zone" value={timeZone} onChange={setTimeZone} />
          <p className="text-sm text-muted">{t('timeZoneHint')}</p>
        </div>
        <FormActions>
          <Button type="submit" loading={state === 'saving'} loadingLabel={t('saving')}>
            {t('save')}
          </Button>
        </FormActions>
        <p role="status" className="text-sm">
          {state === 'saved' ? <span className="text-success">{t('saved')}</span> : null}
          {state === 'failed' ? <span className="text-danger">{t('failed')}</span> : null}
        </p>
      </form>
    </SettingsSection>
  );
}
