'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { ToggleGroup } from './toggle-group';

type ThemeChoice = 'light' | 'dark' | 'system';

const subscribeNothing = () => () => {};

/** Explicit choice among light, dark and the system preference. */
export function ThemeSelector() {
  const t = useTranslations('web.theme');
  const { theme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const value: ThemeChoice = hydrated && (theme === 'light' || theme === 'dark') ? theme : 'system';
  return (
    <ToggleGroup<ThemeChoice>
      type="single"
      label={t('label')}
      value={value}
      onValueChange={setTheme}
      options={[
        {
          value: 'light',
          label: (
            <>
              <Sun aria-hidden />
              {t('light')}
            </>
          ),
        },
        {
          value: 'dark',
          label: (
            <>
              <Moon aria-hidden />
              {t('dark')}
            </>
          ),
        },
        {
          value: 'system',
          label: (
            <>
              <Monitor aria-hidden />
              {t('system')}
            </>
          ),
        },
      ]}
    />
  );
}
