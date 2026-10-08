'use client';

import { FileText, RotateCcw, Upload, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type ClipboardEvent, type DragEvent, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './icon-button';
import { Progress } from './progress';

/** pending: chosen, not sent yet; uploading: sent, `progress` known; processing: checks running. */
export type FileDropState = 'pending' | 'uploading' | 'processing' | 'ready' | 'rejected';

export interface FileDropItem {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  /** Object URL or address of an image preview; a document icon without it. */
  previewUrl?: string | undefined;
  state: FileDropState;
  /** 0 to 100, while uploading. */
  progress?: number | undefined;
  /** Translated reason of a rejection (`reference.mediaRejectionReasons`). */
  reason?: string | undefined;
}

interface FileDropProps {
  /** What the files are for ("Photo de couverture"). */
  label: string;
  /** Limits of the usage, already worded ("JPEG, PNG ou WebP, 8 Mo au plus"). */
  limits: string;
  /** Types the picker offers (`image/png`, `application/pdf`). */
  accept: readonly string[];
  multiple?: boolean;
  disabled?: boolean;
  items: readonly FileDropItem[];
  onFiles: (files: File[]) => void;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
}

/**
 * Drop zone for files: drag and drop, a picker, or a paste once focused. Shows each file with its
 * preview, its upload progress and the states of the checks of the api (processing, ready,
 * rejected with its reason). Uploading is the caller's job (features/media).
 */
export function FileDrop({
  label,
  limits,
  accept,
  multiple = false,
  disabled = false,
  items,
  onFiles,
  onRemove,
  onRetry,
}: FileDropProps) {
  const t = useTranslations('web.ui.file');
  const format = useFormatter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const hintId = useId();

  function take(list: FileList | null | undefined) {
    const files = [...(list ?? [])];
    if (files.length === 0 || disabled) return;
    onFiles(multiple ? files : files.slice(0, 1));
  }

  function size(bytes: number) {
    return format.number(bytes / (bytes >= 1_000_000 ? 1_000_000 : 1_000), {
      maximumFractionDigits: 1,
      style: 'unit',
      unit: bytes >= 1_000_000 ? 'megabyte' : 'kilobyte',
      unitDisplay: 'short',
    });
  }

  return (
    <div className="grid gap-3">
      {/* Drag and drop and paste enhance the zone; the keyboard path is its button. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="group"
        aria-label={label}
        aria-describedby={hintId}
        data-over={over ? '' : undefined}
        onDragOver={(event: DragEvent) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
        onPaste={(event: ClipboardEvent) => take(event.clipboardData.files)}
        className={cn(
          'grid place-items-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-sunken px-6 py-8 text-center transition-colors duration-(--duration-micro)',
          'data-[over]:border-accent data-[over]:bg-accent-subtle',
          disabled && 'opacity-50',
        )}
      >
        <Upload aria-hidden className="size-6 text-muted" />
        <p className="text-sm">
          {t('drop')}{' '}
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-xs link-underline font-medium text-link"
          >
            {t('choose')}
          </button>
        </p>
        <p id={hintId} className="text-xs text-muted">
          {limits} {t('paste')}
        </p>
        <input
          ref={inputRef}
          type="file"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          accept={accept.join(',')}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            take(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {items.length > 0 ? (
        <ul className="grid gap-2" aria-live="polite">
          {items.map((item) => (
            <li
              key={item.id}
              data-state={item.state}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 data-[state=rejected]:border-danger/40"
            >
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-sunken">
                {item.previewUrl ? (
                  // A local preview (object URL): next/image cannot optimise it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt="" className="size-full object-cover" />
                ) : (
                  <FileText aria-hidden className="size-6 text-muted" />
                )}
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p
                  className={cn(
                    'text-xs',
                    item.state === 'rejected'
                      ? 'text-danger'
                      : item.state === 'ready'
                        ? 'text-success'
                        : 'text-muted',
                  )}
                >
                  {size(item.size)} ·{' '}
                  {t(`states.${item.state}`, {
                    percent: item.progress ?? 0,
                    reason: item.reason ?? '',
                  })}
                </p>
                {item.state === 'uploading' || item.state === 'processing' ? (
                  <Progress
                    size="sm"
                    value={item.state === 'uploading' ? (item.progress ?? 0) : null}
                    label={t('progress', { name: item.name })}
                    valueText={item.state === 'uploading' ? `${item.progress ?? 0} %` : undefined}
                  />
                ) : null}
              </div>
              {item.state === 'rejected' && onRetry ? (
                <IconButton
                  size="sm"
                  label={t('retry', { name: item.name })}
                  icon={<RotateCcw />}
                  onClick={() => onRetry(item.id)}
                />
              ) : null}
              {onRemove ? (
                <IconButton
                  size="sm"
                  label={t('remove', { name: item.name })}
                  icon={<X />}
                  onClick={() => onRemove(item.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
