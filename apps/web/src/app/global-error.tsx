'use client';

import en from '@pitchorium/i18n/locales/en/web.json';
import fr from '@pitchorium/i18n/locales/fr/web.json';
import { reportError } from '@/lib/observability/report-error';
import { useEffect } from 'react';
import { StatusView } from '@/components/layout/status-view';
import { Button } from '@/components/ui/button';
import { fontVariables } from '@/styles/fonts';
import '@/styles/globals.css';

/**
 * Last resort when the layout itself fails: no provider is available, so the texts come from
 * the French and English catalogues directly, in the language of the browser.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  const english = typeof navigator !== 'undefined' && navigator.language.startsWith('en');
  const texts = (english ? en : fr).error;
  const locale = english ? 'en' : 'fr';

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <main id="main">
          <StatusView
            title={texts.title}
            body={texts.body}
            reference={
              error.digest ? texts.reference.replace('{{reference}}', error.digest) : undefined
            }
            actions={<Button onClick={reset}>{texts.retry}</Button>}
          />
        </main>
      </body>
    </html>
  );
}
