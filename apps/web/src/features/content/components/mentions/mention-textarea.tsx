'use client';

import { type KeyboardEvent, useId, useState } from 'react';
import { Textarea } from '@/components/ui';
import { insertMention, type MentionQuery, mentionQueryAt } from '../../lib/mention-query';
import { MentionList } from './mention-list';
import { type MentionOption, useMentionSearch } from './use-mention-search';

/**
 * A text area of a comment with the mentions of members and organizations (§10.3): `@` and a
 * few letters propose names from the search (keyboard: arrows, Enter or Tab, Escape; or the
 * mouse), the choice writes `@key` as the api reads it. Ctrl Enter (Cmd Enter) sends.
 */
export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'onSubmit'> & {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}) {
  const listId = useId();
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const { options, loading } = useMentionSearch(mention?.query ?? null);
  const open = mention !== null;

  const track = (element: HTMLTextAreaElement) => {
    const position = element.selectionStart;
    setCaret(position);
    const next = mentionQueryAt(element.value, position);
    setMention(next);
    if (next?.query !== mention?.query) setActive(0);
  };

  const pick = (option: MentionOption, element: HTMLTextAreaElement | null) => {
    if (!mention) return;
    const result = insertMention(value, mention, caret, option.key);
    onChange(result.text);
    setMention(null);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(result.caret, result.caret);
    });
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      onSubmit?.();
      return;
    }
    if (!open || options.length === 0) {
      if (open && event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pick(options[active]!, event.currentTarget);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setMention(null);
    }
  };

  return (
    <div className="relative">
      <Textarea
        {...props}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && options.length > 0}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && options.length > 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          track(event.target);
        }}
        onSelect={(event) => track(event.currentTarget)}
        onKeyDown={keyDown}
        onBlur={() => setMention(null)}
      />
      {open ? (
        <div className="absolute top-full left-0 mt-1">
          <MentionList
            id={listId}
            options={options}
            active={active}
            loading={loading}
            onHover={setActive}
            onPick={(option) =>
              pick(
                option,
                document.querySelector<HTMLTextAreaElement>(`[aria-controls="${listId}"]`),
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}
