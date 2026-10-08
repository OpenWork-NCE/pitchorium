'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { AnimatedNumber, useMotionPreference } from '@/components/motion';
import { Button } from '@/components/ui';

/** Count of the active locales, animated and formatted in the page language. */
export function LocaleCount({ count }: { count: number }) {
  const format = useFormatter();
  const formatCount = useCallback((value: number) => format.number(value), [format]);
  return <AnimatedNumber value={count} format={formatCount} />;
}

/**
 * Motion preference of the visitor and the primary button. Its answer is announced in place:
 * the editorial pages carry no toast library (ADR 0094).
 */
export function MotionCheck() {
  const t = useTranslations('web.home');
  const reduced = useMotionPreference() === 'reduced';
  const [checked, setChecked] = useState(false);
  return (
    <>
      <p className="mt-3 text-2xl font-semibold">
        {reduced ? t('motionReduced') : t('motionFull')}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => setChecked(true)}>{t('check')}</Button>
        <p role="status" className="text-sm text-muted">
          {checked ? t('checked') : null}
        </p>
      </div>
    </>
  );
}
