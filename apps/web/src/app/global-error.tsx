'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { reportError } from '@/lib/observability/report-error';
import { fontVariables } from '@/styles/fonts';
import '@/styles/globals.css';

/** The view and its catalogues arrive with the error only: every page carries this boundary. */
const GlobalErrorView = dynamic(() => import('@/components/layout/global-error-view'), {
  ssr: false,
});

/** Last resort when the layout itself fails, in the language of the browser (French or English). */
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

  return (
    <html lang={english ? 'en' : 'fr'} className={fontVariables}>
      <body>
        <main id="main">
          <GlobalErrorView english={english} digest={error.digest} reset={reset} />
        </main>
      </body>
    </html>
  );
}
