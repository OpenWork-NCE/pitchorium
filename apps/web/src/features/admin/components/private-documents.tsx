'use client';

import { mediaControllerDownload } from '@pitchorium/api-client';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Text } from '@/components/ui';
import { useConsoleProblem } from './use-console-problem';

/**
 * The private documents of a request (identity, verification, proof): each opens by a short
 * signed address asked at the click (the media module checks that the reader may read it),
 * never kept nor shown in the page.
 */
export function PrivateDocuments({ mediaIds }: { mediaIds: readonly string[] }) {
  const t = useTranslations('web.admin.documents');
  const problem = useConsoleProblem();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function open(mediaId: string) {
    setOpening(mediaId);
    setError(null);
    try {
      const { url } = await mediaControllerDownload(mediaId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setOpening(null);
    }
  }
  if (mediaIds.length === 0) {
    return (
      <Text size="sm" tone="muted">
        {t('none')}
      </Text>
    );
  }
  return (
    <div className="grid gap-2">
      <ul className="flex flex-wrap gap-2">
        {mediaIds.map((mediaId, index) => (
          <li key={mediaId}>
            <Button
              size="sm"
              variant="outline"
              loading={opening === mediaId}
              loadingLabel={t('opening')}
              onClick={() => void open(mediaId)}
            >
              <FileText aria-hidden className="size-4" />
              {t('document', { index: index + 1 })}
            </Button>
          </li>
        ))}
      </ul>
      <Text size="sm" tone="muted">
        {t('signed')}
      </Text>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
