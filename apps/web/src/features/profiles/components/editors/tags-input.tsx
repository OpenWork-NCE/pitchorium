'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Input, Tag } from '@/components/ui';

/**
 * Free words of a list (sought expertise): typed one by one, added with Enter or the button,
 * removed from their tag. Duplicates and empty words are ignored; `max` words at most.
 */
export function TagsInput({
  value,
  onChange,
  max,
  maxLength,
  placeholder,
}: {
  value: readonly string[];
  onChange: (value: string[]) => void;
  max: number;
  maxLength: number;
  placeholder?: string;
}) {
  const t = useTranslations('web.profile.edit.tags');
  const [draft, setDraft] = useState('');
  const full = value.length >= max;

  function add() {
    const word = draft.trim();
    if (!word || full || value.some((item) => item.toLowerCase() === word.toLowerCase())) return;
    onChange([...value, word]);
    setDraft('');
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={full}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            add();
          }}
        />
        <Button type="button" variant="outline" disabled={full || !draft.trim()} onClick={add}>
          {t('add')}
        </Button>
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('list')}>
          {value.map((item) => (
            <li key={item}>
              <Tag
                removeLabel={t('remove', { item })}
                onRemove={() => onChange(value.filter((other) => other !== item))}
              >
                {item}
              </Tag>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
