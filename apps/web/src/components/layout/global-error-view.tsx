'use client';

import en from '@pitchorium/i18n/locales/en/web.json';
import fr from '@pitchorium/i18n/locales/fr/web.json';
import { Button } from '@/components/ui/button';
import { StatusView } from './status-view';

/**
 * View of the last-resort error: no provider is available, so the texts come from the French and
 * English catalogues directly. Loaded only once an error occurred (app/global-error.tsx), so that
 * the catalogues never weigh on the first load of a page.
 */
export default function GlobalErrorView({
  english,
  digest,
  reset,
}: {
  english: boolean;
  digest: string | undefined;
  reset: () => void;
}) {
  const texts = (english ? en : fr).error;
  return (
    <StatusView
      title={texts.title}
      body={texts.body}
      reference={digest ? texts.reference.replace('{{reference}}', digest) : undefined}
      actions={<Button onClick={reset}>{texts.retry}</Button>}
    />
  );
}
