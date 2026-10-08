'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { AnimatedNumber, useMotionPreference } from '@/components/motion';
import { Button } from '@/components/ui';

/** Count of the active locales, animated and formatted in the page language. */
export function LocaleCount({ count }: { count: number }) {
  const format = useFormatter();
  const formatCount = useCallback((value: number) => format.number(value), [format]);
  return <AnimatedNumber value={count} format={formatCount} />;
}

/** Motion preference of the visitor and the primary button with its toast. */
export function MotionCheck() {
  const t = useTranslations('web.home');
  const reduced = useMotionPreference() === 'reduced';
  return (
    <>
      <p className="mt-3 text-2xl font-semibold">
        {reduced ? t('motionReduced') : t('motionFull')}
      </p>
      <div className="mt-4">
        <Button onClick={() => toast.success(t('checked'))}>{t('check')}</Button>
      </div>
    </>
  );
}
