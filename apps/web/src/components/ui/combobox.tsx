'use client';

import { Command } from 'cmdk';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { usePlural } from '@/lib/i18n/plural';
import { useFieldControl } from './field';
import { controlClasses } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Spinner } from './spinner';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Second line (a region, a code). */
  hint?: string;
}

interface CommonProps {
  /** Options known now; with `onSearch`, the options of the last answer. */
  options: readonly ComboboxOption[];
  /** Search on the server: called with the typed text (after a short pause). */
  onSearch?: (query: string) => void;
  /** A search is running. */
  loading?: boolean;
  placeholder?: string;
  /** Labels of the selected values the options do not hold (selected before a search). */
  selectedLabels?: Readonly<Record<string, string>>;
  disabled?: boolean;
  id?: string;
  'aria-describedby'?: string;
  className?: string;
}

type ComboboxProps = CommonProps &
  (
    | { multiple?: false; value: string | null; onValueChange: (value: string | null) => void }
    | {
        multiple: true;
        value: readonly string[];
        onValueChange: (value: string[]) => void;
        max?: number;
      }
  );

/**
 * A choice in a long list to search (cmdk in a Radix Popover): countries, sectors, people. Typing
 * filters (or searches on the server with `onSearch`), arrows move, Enter selects. With
 * `multiple`, the choices show as chips that can be removed one by one; the list stays open.
 */
export function Combobox(props: ComboboxProps) {
  const t = useTranslations('web.ui.combobox');
  const plural = usePlural();
  const control = useFieldControl<{
    id?: string | undefined;
    'aria-describedby'?: string | undefined;
    'aria-invalid'?: boolean | undefined;
    disabled?: boolean | undefined;
  }>({ id: props.id, 'aria-describedby': props['aria-describedby'], disabled: props.disabled });
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { options, onSearch, loading = false, selectedLabels = {} } = props;
  const selected = props.multiple ? props.value : props.value ? [props.value] : [];
  const labelOf = (value: string) =>
    options.find((option) => option.value === value)?.label ?? selectedLabels[value] ?? value;

  // The server search starts after a pause in typing, not at every key.
  useEffect(() => {
    if (!onSearch) return;
    const timer = setTimeout(() => onSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  function toggle(value: string) {
    if (props.multiple) {
      const has = props.value.includes(value);
      if (!has && props.max !== undefined && props.value.length >= props.max) return;
      props.onValueChange(
        has ? props.value.filter((item) => item !== value) : [...props.value, value],
      );
    } else {
      props.onValueChange(props.value === value ? null : value);
      setOpen(false);
    }
  }

  const triggerText: ReactNode =
    !props.multiple && props.value ? labelOf(props.value) : (props.placeholder ?? t('placeholder'));

  return (
    <div className={cn('grid gap-2', props.className)}>
      {props.multiple && selected.length > 0 ? (
        <ul
          aria-label={t(`selected.${plural(selected.length)}`, { count: selected.length })}
          className="flex flex-wrap gap-1.5"
        >
          {selected.map((value) => (
            <li
              key={value}
              className="inline-flex items-center gap-1 rounded-full bg-accent-subtle py-1 pr-1 pl-3 text-sm text-on-accent-subtle"
            >
              {labelOf(value)}
              <button
                type="button"
                disabled={control.disabled}
                aria-label={t('remove', { label: labelOf(value) })}
                onClick={() => toggle(value)}
                className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-on-accent-subtle/10 focus-visible:outline-2 focus-visible:outline-focus max-sm:size-8"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={control.id}
            role="combobox"
            aria-expanded={open}
            // The list exists only while open: no reference to a missing element.
            aria-controls={open ? listId : undefined}
            aria-haspopup="listbox"
            aria-describedby={control['aria-describedby']}
            aria-invalid={control['aria-invalid']}
            disabled={control.disabled}
            className={cn(
              controlClasses,
              'flex h-11 cursor-pointer items-center justify-between gap-2 px-3 text-left',
              (props.multiple || !props.value) && 'text-muted',
            )}
          >
            <span className="truncate">{triggerText}</span>
            <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command shouldFilter={!onSearch} loop label={props.placeholder ?? t('placeholder')}>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t('search')}
                className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted"
              />
              {loading ? <Spinner size="sm" label={t('loading')} /> : null}
            </div>
            <Command.List id={listId} className="max-h-72 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
                {loading ? t('loading') : t('empty')}
              </Command.Empty>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <Command.Item
                    key={option.value}
                    value={`${option.label} ${option.hint ?? ''} ${option.value}`}
                    onSelect={() => toggle(option.value)}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-none data-[selected=true]:bg-surface-sunken sm:min-h-10"
                  >
                    <span className="inline-flex size-4 shrink-0 items-center justify-center">
                      {isSelected ? <Check aria-hidden className="size-4 text-accent" /> : null}
                    </span>
                    {/* cmdk keeps aria-selected for the highlighted option: the choice is said. */}
                    {isSelected ? <span className="sr-only">{t('isSelected')}</span> : null}
                    <span className="grid">
                      <span>{option.label}</span>
                      {option.hint ? (
                        <span className="text-xs text-muted">{option.hint}</span>
                      ) : null}
                    </span>
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
