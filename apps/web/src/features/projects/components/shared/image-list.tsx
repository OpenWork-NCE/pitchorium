'use client';

import { AlertTriangle, ArrowDown, ArrowUp, RotateCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Field, IconButton, ProgressRing, Textarea } from '@/components/ui';
import { PROJECT_LIMITS } from '../../lib/limits';
import type { ImageItem } from './use-image-uploads';

/**
 * The images of a gallery or of an update being written: in their order (« Monter »,
 * « Descendre »), each with its text alternative, asked for clearly, and the state of its sending
 * (lighter, sent, checked, refused with its reason, failed with « Réessayer »).
 */
export function ImageList({
  items,
  onMove,
  onRemove,
  onRetry,
  onAlt,
  onAltBlur,
}: {
  items: readonly ImageItem[];
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onAlt: (id: string, alt: string) => void;
  onAltBlur?: () => void;
}) {
  const t = useTranslations('web.projects.images');
  const rejections = useTranslations('reference.mediaRejectionReasons');
  if (items.length === 0) return null;
  return (
    <ol className="grid gap-4">
      {items.map((item, index) => {
        const working = ['compressing', 'sending', 'checking'].includes(item.state);
        return (
          <li
            key={item.id}
            className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[8rem_minmax(0,1fr)]"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-sunken">
              {item.previewUrl ? (
                // A local preview or a variant of the media module.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt="" className="size-full object-cover" />
              ) : null}
              {working ? (
                <span className="absolute inset-0 flex items-center justify-center bg-overlay">
                  <ProgressRing
                    value={item.state === 'sending' ? item.progress : null}
                    label={t(`states.${item.state}`, { name: item.name })}
                  />
                </span>
              ) : null}
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{t('position', { index: index + 1 })}</p>
                <div className="flex gap-1">
                  <IconButton
                    type="button"
                    size="sm"
                    label={t('moveUp', { index: index + 1 })}
                    icon={<ArrowUp />}
                    disabled={index === 0}
                    onClick={() => onMove(index, index - 1)}
                  />
                  <IconButton
                    type="button"
                    size="sm"
                    label={t('moveDown', { index: index + 1 })}
                    icon={<ArrowDown />}
                    disabled={index === items.length - 1}
                    onClick={() => onMove(index, index + 1)}
                  />
                  {item.state === 'failed' ? (
                    <IconButton
                      type="button"
                      size="sm"
                      label={t('retry', { index: index + 1 })}
                      icon={<RotateCw />}
                      onClick={() => onRetry(item.id)}
                    />
                  ) : null}
                  <IconButton
                    type="button"
                    size="sm"
                    label={t('remove', { index: index + 1 })}
                    icon={<X />}
                    onClick={() => onRemove(item.id)}
                  />
                </div>
              </div>
              {item.state === 'rejected' || item.state === 'failed' ? (
                <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
                  <AlertTriangle aria-hidden className="size-4" />
                  {item.state === 'rejected' && item.reason && rejections.has(item.reason as never)
                    ? rejections(item.reason as never)
                    : t('failed')}
                </p>
              ) : null}
              <Field
                label={t('alt', { index: index + 1 })}
                description={item.alt.trim() ? t('altHint') : t('altMissing')}
                counter={{ count: item.alt.length, max: PROJECT_LIMITS.imageAlt }}
              >
                <Textarea
                  value={item.alt}
                  rows={2}
                  onChange={(event) => onAlt(item.id, event.target.value)}
                  onBlur={onAltBlur}
                />
              </Field>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
