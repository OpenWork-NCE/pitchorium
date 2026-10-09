'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { pluralOf } from './plural-of';

/**
 * Plural category of a count in the page language, `one` or `other`: the catalogues hold the
 * two forms under these keys (their `{{name}}` parameters have no ICU plural, ADR 0084). French
 * says "0 jour", English "0 days".
 */
export function usePlural(): (count: number) => 'one' | 'other' {
  const locale = useLocale();
  return useCallback((count: number) => pluralOf(locale, count), [locale]);
}
