'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';
import { useState, useTransition } from 'react';
import { Button, DateTimeField, Field } from '@/components/ui';

/** The period of the transparency counters, in the address (`?from=&to=`, days, `to` included). */
export function TransparencyPeriod({ from, to }: { from: string; to: string }) {
  const t = useTranslations('web.admin.moderation.transparency');
  const [pending, startTransition] = useTransition();
  const [, setPeriod] = useQueryStates(
    { from: parseAsString, to: parseAsString },
    { shallow: false, startTransition },
  );
  const [start, setStart] = useState<string | null>(from);
  const [end, setEnd] = useState<string | null>(to);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (start && end) void setPeriod({ from: start, to: end });
      }}
    >
      <Field label={t('from')}>
        <DateTimeField granularity="day" value={start} onChange={setStart} />
      </Field>
      <Field label={t('to')}>
        <DateTimeField granularity="day" value={end} onChange={setEnd} />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} loadingLabel={t('apply')}>
        {t('apply')}
      </Button>
    </form>
  );
}
