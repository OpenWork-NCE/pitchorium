'use client';

import { Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { MentionOption } from './use-mention-search';

/**
 * Suggestions of members and organizations to mention (a listbox driven by the field it belongs
 * to: arrows, Enter or Tab to choose, Escape to close), with the mouse as well.
 */
export function MentionList({
  id,
  options,
  active,
  loading,
  onPick,
  onHover,
}: {
  id: string;
  options: readonly MentionOption[];
  active: number;
  loading: boolean;
  onPick: (option: MentionOption) => void;
  onHover: (index: number) => void;
}) {
  const t = useTranslations('web.composer');
  return (
    <div className="z-(--z-overlay) w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface-elevated p-1 shadow-md">
      <div id={id} role="listbox" aria-label={t('mentions')} className="grid">
        {options.map((option, index) => (
          // The field keeps the focus and drives the list (aria-activedescendant): the keyboard
          // acts through it, the mouse here.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <div
            key={`${option.kind}:${option.key}`}
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === active}
            tabIndex={-1}
            // The field keeps the focus: a press must not take it.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onPick(option)}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
              index === active && 'bg-surface-sunken',
            )}
          >
            {option.kind === 'member' ? (
              <Avatar name={option.label} src={null} size="xs" decorative />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-sm bg-surface-sunken">
                <Building2 aria-hidden className="size-4 text-muted" />
              </span>
            )}
            <span className="grid min-w-0">
              <span className="truncate font-medium">{option.label}</span>
              <span className="truncate text-xs text-muted">
                @{option.key}
                {option.subtitle ? ` · ${option.subtitle}` : ''}
              </span>
            </span>
          </div>
        ))}
      </div>
      {options.length === 0 ? (
        <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted">
          {loading ? <Spinner size="sm" /> : null}
          {loading ? null : t('mentionsEmpty')}
        </p>
      ) : null}
    </div>
  );
}
