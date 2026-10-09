'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, ArrowLeft, ArrowRight, GripVertical, RotateCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Field, IconButton, ProgressRing, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LIMITS } from '../../lib/limits';
import type { UploadItem } from './use-uploads';

/**
 * The images of a publication being written: in their order, moved by dragging, by the
 * keyboard (Space on the handle, then the arrows) or by the buttons « Déplacer avant / après »;
 * each with its text alternative, asked for clearly, and the state of its sending (lighter,
 * sent, checked, refused with its reason, failed with « Réessayer »).
 */
export function ImageTray({
  items,
  onMove,
  onRemove,
  onRetry,
  onAlt,
  editable = true,
}: {
  items: readonly UploadItem[];
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onAlt: (id: string, alt: string) => void;
  /** An edited publication keeps its images: only their text alternatives change. */
  editable?: boolean;
}) {
  const t = useTranslations('web.composer');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const end = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onMove(
      items.findIndex((item) => item.id === active.id),
      items.findIndex((item) => item.id === over.id),
    );
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={end}
      accessibility={{
        announcements: {
          onDragStart: () => '',
          onDragOver: () => '',
          onDragEnd: ({ over }) =>
            over
              ? t('moved', {
                  index: items.findIndex((item) => item.id === over.id) + 1,
                  count: items.length,
                })
              : '',
          onDragCancel: () => '',
        },
        screenReaderInstructions: { draggable: t('reorder') },
      }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <ul aria-label={t('images')} className="grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => (
            <SortableImage
              key={item.id}
              item={item}
              index={index}
              count={items.length}
              editable={editable}
              onMove={onMove}
              onRemove={onRemove}
              onRetry={onRetry}
              onAlt={onAlt}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableImage({
  item,
  index,
  count,
  editable,
  onMove,
  onRemove,
  onRetry,
  onAlt,
}: {
  item: UploadItem;
  index: number;
  count: number;
  editable: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onAlt: (id: string, alt: string) => void;
}) {
  const t = useTranslations('web.composer');
  const reasons = useTranslations('reference.mediaRejectionReasons');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !editable });
  const label = t('imageLabel', { index: index + 1, count });
  const busy =
    item.state === 'compressing' || item.state === 'sending' || item.state === 'checking';
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'grid gap-2 rounded-lg border border-border bg-surface p-2',
        isDragging && 'z-(--z-raised) shadow-md',
        item.state === 'rejected' || item.state === 'failed' ? 'border-danger/50' : null,
      )}
    >
      <div className="relative aspect-4/3 overflow-hidden rounded-md bg-surface-sunken">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of the file chosen.
          <img src={item.previewUrl} alt="" className="size-full object-cover" />
        ) : null}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-overlay">
            <ProgressRing
              value={item.state === 'sending' ? item.progress : null}
              label={
                item.state === 'compressing'
                  ? t('compressing')
                  : item.state === 'sending'
                    ? t('sending', { percent: Math.round(item.progress * 100) })
                    : t('checking')
              }
            />
          </span>
        ) : null}
        <div className="absolute top-1 right-1 flex gap-1">
          {editable ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label={`${t('reorder')} : ${label}`}
              className="flex size-11 cursor-grab items-center justify-center rounded-full bg-surface-elevated text-foreground shadow-xs outline-none focus-visible:outline-2 focus-visible:outline-focus active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical aria-hidden className="size-5" />
            </button>
          ) : null}
          {editable ? (
            <IconButton
              label={`${t('remove')} : ${label}`}
              icon={<X />}
              variant="secondary"
              size="sm"
              onClick={() => onRemove(item.id)}
            />
          ) : null}
        </div>
      </div>
      {item.state === 'rejected' || item.state === 'failed' ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">
            {item.state === 'rejected' && item.reason && reasons.has(item.reason as never)
              ? reasons(item.reason as never)
              : t('uploadFailed')}
          </span>
          {item.file ? (
            <IconButton
              label={`${t('retry')} : ${label}`}
              icon={<RotateCw />}
              size="sm"
              onClick={() => onRetry(item.id)}
            />
          ) : null}
        </p>
      ) : null}
      <Field
        label={t('alt', { index: index + 1 })}
        description={t('altHint')}
        counter={{ count: item.text.length, max: LIMITS.imageAlt }}
      >
        <Textarea
          value={item.text}
          minRows={2}
          maxRows={5}
          onChange={(event) => onAlt(item.id, event.target.value)}
          aria-invalid={item.text.trim() === '' ? undefined : item.text.length > LIMITS.imageAlt}
        />
      </Field>
      {item.text.trim() === '' ? (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle aria-hidden className="size-3.5" />
          {t('altMissing')}
        </p>
      ) : null}
      {editable && count > 1 ? (
        <div className="flex justify-between gap-2">
          <IconButton
            label={`${t('moveBefore')} : ${label}`}
            icon={<ArrowLeft />}
            size="sm"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          />
          <IconButton
            label={`${t('moveAfter')} : ${label}`}
            icon={<ArrowRight />}
            size="sm"
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
          />
        </div>
      ) : null}
    </li>
  );
}
