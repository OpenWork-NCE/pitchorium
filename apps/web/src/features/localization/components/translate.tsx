'use client';

import type { TranslationSourceType } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { Button } from '@/components/ui';
import { useActiveLocales } from './active-locales';

/** A content the member may have translated (§8.3): its type and identifier for the api. */
export interface TranslationSource {
  type: TranslationSourceType;
  id: string;
}

/** How the translated field is drawn: plain text, or the restricted Markdown of the api. */
export type TranslationFormat = 'text' | 'markdown';

const loadTranslation = () => import('./translation');
const ActiveTranslation = lazy(loadTranslation);

/**
 * Whether « Traduire » is offered: the language of the content is known and differs from the
 * interface, whose language is active (§8.3). The api decides on the translation itself.
 */
export function useTranslationOffered(language: string | null | undefined): boolean {
  const locale = useLocale();
  const active = useActiveLocales();
  return Boolean(language) && language !== locale && active.includes(locale);
}

/**
 * « Traduire » under a content written in another language than the interface, then its machine
 * translation in place. Only the button is in the first load of a page: the request, the mention
 * and the cross fade load at the press (ADR 0094, ADR 0164).
 */
export function Translatable({
  source,
  language,
  field = 'text',
  format = 'text',
  children,
}: {
  source: TranslationSource;
  language: string | null | undefined;
  /** The field of the api the children show (`text`, `bio`, `description`). */
  field?: string;
  format?: TranslationFormat;
  children: ReactNode;
}) {
  const t = useTranslations('web.translation');
  const offered = useTranslationOffered(language);
  const [asked, setAsked] = useState(false);
  if (!offered) return <>{children}</>;
  if (asked) {
    return (
      <Translated source={source} language={language} field={field} format={format}>
        {children}
      </Translated>
    );
  }
  return (
    <>
      {children}
      <Button
        type="button"
        variant="link"
        size="sm"
        className="mt-1"
        onPointerEnter={() => void loadTranslation()}
        onClick={() => setAsked(true)}
      >
        {t('translate')}
      </Button>
    </>
  );
}

/**
 * A translation asked for by another action (« Traduire » in the menu of a message, §8.3): the
 * original until its module arrives, then the translation in place.
 */
export function Translated({
  source,
  language,
  field = 'text',
  format = 'text',
  children,
}: {
  source: TranslationSource;
  language: string | null | undefined;
  field?: string;
  format?: TranslationFormat;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={children}>
      <ActiveTranslation source={source} language={language} field={field} format={format}>
        {children}
      </ActiveTranslation>
    </Suspense>
  );
}
