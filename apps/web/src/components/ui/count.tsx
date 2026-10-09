'use client';

import { useFormatter } from 'next-intl';
import { AnimatedNumber } from '@/components/motion';

/**
 * A count (connections, followers, visits) formatted in the language of the page, which counts
 * up once it comes into view (H17); the server renders its final value. A server component hands
 * the number only: the formatter lives here.
 */
export function Count({ value, className }: { value: number; className?: string }) {
  const format = useFormatter();
  return (
    <AnimatedNumber
      value={value}
      format={(current) => format.number(current)}
      className={className}
    />
  );
}
