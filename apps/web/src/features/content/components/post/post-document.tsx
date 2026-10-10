'use client';

import type { PostDocument as PostDocumentData } from '@pitchorium/contracts';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, notify } from '@/components/ui';
import { usePlural } from '@/lib/i18n/plural';

/**
 * The PDF of a publication: its first page, its title and its number of pages; opened or
 * downloaded through an address the api signs for a short while, asked at the click (the file is
 * always private, ADR 0026), for a reader who may see the publication.
 */
export function PostDocument({
  document,
  signedIn,
}: {
  document: PostDocumentData;
  /** A visitor cannot open a private file: the title and the first page only. */
  signedIn: boolean;
}) {
  const t = useTranslations('web.content.document');
  const plural = usePlural();
  const [busy, setBusy] = useState<'open' | 'download' | null>(null);
  const title = document.title ?? t('fallbackTitle');

  async function go(action: 'open' | 'download') {
    // The window opens at the click (a later one would be blocked), then gets its address.
    const opened = action === 'open' ? window.open('', '_blank', 'noopener') : null;
    setBusy(action);
    try {
      // The client of the api (and TanStack Query with it) stays out of the first load of a
      // visitor's page: loaded at the click.
      const { mediaControllerDownload } = await import('@pitchorium/api-client');
      const { url } = await mediaControllerDownload(document.mediaId);
      if (action === 'open') {
        if (opened) opened.location.href = url;
        else window.location.href = url;
      } else {
        const link = window.document.createElement('a');
        link.href = url;
        link.download = `${title}.pdf`;
        link.rel = 'noopener';
        link.click();
      }
    } catch {
      opened?.close();
      notify.error(t('failed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-sunken p-3">
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface">
        {document.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned thumbnail of a private file.
          <img
            src={document.thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <FileText aria-hidden className="size-6 text-muted" />
        )}
      </span>
      <span className="grid min-w-40 flex-1 gap-0.5">
        <span className="truncate font-semibold">{title}</span>
        {document.pageCount ? (
          <span className="text-sm text-muted">
            {t(`pages.${plural(document.pageCount)}`, { count: document.pageCount })}
          </span>
        ) : null}
      </span>
      {signedIn ? (
        <span className="flex shrink-0 flex-wrap gap-1">
          <Button
            variant="ghost"
            size="sm"
            loading={busy === 'open'}
            onClick={() => void go('open')}
          >
            <ExternalLink aria-hidden />
            {t('open')}
            <span className="sr-only"> {title}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={busy === 'download'}
            onClick={() => void go('download')}
          >
            <Download aria-hidden />
            {t('download')}
            <span className="sr-only"> {title}</span>
          </Button>
        </span>
      ) : null}
    </div>
  );
}
