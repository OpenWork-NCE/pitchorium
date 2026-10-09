'use client';

import type { LinkPreviewDraft } from '@pitchorium/contracts';
import { ExternalLink, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton, Skeleton } from '@/components/ui';

/**
 * The preview of the link of the publication being written (ADR 0118): an attente while the
 * worker reads the page, then its image (imported by the platform), its title and its site;
 * « Retirer l'aperçu » keeps the link in the text, without card.
 */
export function LinkPreviewCard({
  url,
  preview,
  onRemove,
}: {
  url: string;
  preview: LinkPreviewDraft | null;
  onRemove?: () => void;
}) {
  const t = useTranslations('web.composer');
  const pending = !preview || preview.status === 'pending';
  return (
    <div
      className="relative grid overflow-hidden rounded-lg border border-border bg-surface-sunken"
      aria-busy={pending}
    >
      {preview?.imageUrl ? (
        <span className="block aspect-video overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- image imported by the platform. */}
          <img src={preview.imageUrl} alt="" className="size-full object-cover" />
        </span>
      ) : null}
      <span className="grid gap-1 p-3 pr-14">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <ExternalLink aria-hidden className="size-3.5" />
          {preview?.siteName ?? new URL(url).hostname}
        </span>
        {pending ? (
          <>
            <Skeleton className="h-4 w-3/4" />
            <span role="status" className="text-sm text-muted">
              {t('linkPending')}
            </span>
          </>
        ) : preview?.status === 'failed' ? (
          <span className="text-sm text-muted">{t('linkFailed')}</span>
        ) : (
          <>
            {preview?.title ? (
              <span className="line-clamp-2 font-semibold">{preview.title}</span>
            ) : null}
            {preview?.description ? (
              <span className="line-clamp-2 text-sm text-muted">{preview.description}</span>
            ) : null}
          </>
        )}
      </span>
      {onRemove ? (
        <IconButton
          label={t('removePreview')}
          icon={<X />}
          variant="secondary"
          size="sm"
          onClick={onRemove}
          className="absolute top-2 right-2"
        />
      ) : null}
    </div>
  );
}
