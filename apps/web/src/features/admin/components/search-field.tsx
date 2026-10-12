'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { useRef, useState, useTransition } from 'react';
import { Button, Field, Input, useShortcut } from '@/components/ui';

/**
 * The search of a list of the console: the text goes to the address (`?q=`), the server reads
 * it again; `/` puts the focus in it (AdminShortcuts lists the shortcut).
 */
export function SearchField({
  label,
  placeholder,
  param = 'q',
  minLength = 2,
}: {
  label: string;
  placeholder: string;
  param?: string;
  minLength?: number;
}) {
  const t = useTranslations('web.admin');
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useQueryState(
    param,
    parseAsString.withDefault('').withOptions({ shallow: false, startTransition }),
  );
  const [draft, setDraft] = useState(query);
  const field = useRef<HTMLInputElement>(null);
  useShortcut({
    keys: '/',
    label: t('shortcuts.search'),
    group: t('shortcuts.group'),
    run: () => field.current?.focus(),
  });
  return (
    <form
      role="search"
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const text = draft.trim();
        void setQuery(text.length >= minLength ? text : null);
      }}
    >
      <Field label={label} description={t('common.searchHint')} className="min-w-64 flex-1">
        <Input
          ref={field}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          startAdornment={<Search aria-hidden className="size-4" />}
        />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} loadingLabel={t('common.search')}>
        {t('common.search')}
      </Button>
    </form>
  );
}
