import type { Preview } from '@storybook/nextjs-vite';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { useEffect } from 'react';
import { clientMessages, messagesFor } from '../src/lib/i18n/messages';
import { fontVariables } from '../src/styles/fonts';
import '../src/styles/globals.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
    locale: {
      description: 'Locale',
      toolbar: { icon: 'globe', items: ['fr', 'en'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light', locale: 'fr' },
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    nextjs: { appDirectory: true },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'dark' ? 'dark' : 'light';
      const locale = context.globals.locale === 'en' ? 'en' : 'fr';
      useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.className = fontVariables;
        document.documentElement.lang = locale;
      }, [theme, locale]);
      return (
        <NextIntlClientProvider
          locale={locale}
          messages={clientMessages(messagesFor(locale))}
          timeZone="UTC"
        >
          <ThemeProvider attribute="data-theme" forcedTheme={theme}>
            <div className="bg-background p-6 font-sans text-foreground">
              <Story />
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      );
    },
  ],
};

export default preview;
