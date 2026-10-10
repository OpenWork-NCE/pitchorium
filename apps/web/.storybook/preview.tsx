import type { Decorator, Preview } from '@storybook/nextjs-vite';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useEffect } from 'react';
import { configure } from 'storybook/test';
import { messagesFor } from '../src/lib/i18n/messages';
import { STORY_NOW } from '../src/stories/compositions/fixtures';
import { fontVariables } from '../src/styles/fonts';
import '../src/styles/globals.css';

// The stories run as tests two themes at once, many files in parallel: under that load an element
// a play function waits for (findBy, waitFor) can take more than the 1 s of Testing Library.
configure({ asyncUtilTimeout: 5000 });

type ThemeGlobal = 'light' | 'dark' | 'side-by-side';

function Canvas({
  theme,
  padded,
  children,
}: {
  theme: 'light' | 'dark';
  padded: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-theme={theme}
      className={`bg-background font-sans text-foreground ${padded ? 'p-6' : ''}`}
    >
      {children}
    </div>
  );
}

/**
 * Theme, language and the providers of an interactive shell (messages). `side-by-side`
 * shows the story in both themes at once (the dark tokens apply to a subtree marked dark); the
 * tests run each theme on its own (vitest.config.mts).
 */
function StoryProviders({
  theme,
  locale,
  padded,
  children,
}: {
  theme: ThemeGlobal;
  locale: 'fr' | 'en';
  padded: boolean;
  children: ReactNode;
}) {
  const rootTheme = theme === 'dark' ? 'dark' : 'light';
  useEffect(() => {
    document.documentElement.dataset.theme = rootTheme;
    document.documentElement.style.colorScheme = rootTheme;
    document.documentElement.className = fontVariables;
    // The next/font mock of Storybook ignores `declarations`: the faces of Poppins are declared
    // under their family name, which the variables must then name as Next.js does.
    document.documentElement.style.setProperty('--font-poppins', 'Poppins');
    document.documentElement.style.setProperty('--font-poppins-strong', 'Poppins');
    document.documentElement.lang = locale;
  }, [rootTheme, locale]);
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messagesFor(locale)}
      timeZone="Europe/Paris"
      // A fixed clock: the relative dates of the stories (« il y a 5 heures », « Hier ») and their
      // captures do not depend on the day they run.
      now={STORY_NOW}
    >
      <ThemeProvider attribute="data-theme" forcedTheme={rootTheme}>
        {theme === 'side-by-side' ? (
          <div className="grid min-h-dvh lg:grid-cols-2">
            <Canvas theme="light" padded={padded}>
              {children}
            </Canvas>
            <Canvas theme="dark" padded={padded}>
              {children}
            </Canvas>
          </div>
        ) : (
          <Canvas theme={rootTheme} padded={padded}>
            {children}
          </Canvas>
        )}
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

const withProviders: Decorator = (Story, context) => (
  <StoryProviders
    theme={(context.globals.theme as ThemeGlobal | undefined) ?? 'light'}
    locale={context.globals.locale === 'en' ? 'en' : 'fr'}
    padded={context.parameters.layout !== 'fullscreen'}
  >
    <Story />
  </StoryProviders>
);

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { icon: 'mirror', items: ['light', 'dark', 'side-by-side'], dynamicTitle: true },
    },
    locale: {
      description: 'Locale',
      toolbar: { icon: 'globe', items: ['fr', 'en'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light', locale: 'fr' },
  parameters: {
    layout: 'padded',
    // The accessibility addon fails a story on any violation (WCAG 2.2 AA), in both themes.
    a11y: {
      test: 'error',
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      },
    },
    nextjs: { appDirectory: true },
    controls: { expanded: true },
    options: {
      storySort: { order: ['Foundations', 'Design system', 'Motion', 'Compositions'] },
    },
  },
  decorators: [withProviders],
};

export default preview;
