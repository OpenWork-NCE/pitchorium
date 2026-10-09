import type { SuggestionSentence } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** Parameters of a reason that are codes of labelled values, and the group of their label. */
const LABELLED: Readonly<Record<string, string>> = {
  need: 'entrepreneurNeeds',
  hat: 'contributorHats',
  // The short label (« Énergie »): the full one goes in the tooltip and on the detail pages.
  sector: 'sectorsShort',
  instrument: 'fundingInstruments',
};

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

/**
 * Reason sentence of a suggestion (§11.4, ADR 0067): « Propose du mentorat · secteur commun :
 * Énergie », neutral and without the name shown above it. The same as `suggestionSentenceText` of
 * @pitchorium/i18n but from the messages of the page: on the server and in the browser, for the
 * suggestions of the next pages of the feed too.
 */
export function useSuggestionReason(): (sentence: SuggestionSentence) => string {
  const discovery = useTranslations('discovery');
  const reference = useTranslations('reference');
  const locale = useLocale();
  return useCallback(
    (sentence: SuggestionSentence) => {
      const label = (params: Readonly<Record<string, string>>) =>
        Object.fromEntries(
          Object.entries(params).map(([name, value]) => {
            const group = LABELLED[name];
            if (group) {
              const key = `${group}.${value}` as Parameters<typeof reference>[0];
              return [name, reference.has(key) ? reference(key) : value];
            }
            if (name === 'country') {
              const key = `countries.${value}` as Parameters<typeof reference>[0];
              return [name, reference.has(key) ? reference(key) : value];
            }
            if (name === 'language') {
              return [
                name,
                new Intl.DisplayNames([locale], { type: 'language' }).of(value) ?? value,
              ];
            }
            return [name, value];
          }),
        );
      const text = (key: string, values: Record<string, string>) => {
        const typed = key as Parameters<typeof discovery>[0];
        return discovery.has(typed) ? discovery(typed, values) : '';
      };
      const [first = '', second = ''] = sentence.clauses.map((clause) =>
        text(clause.key, label(clause.params)),
      );
      // The second reason continues the sentence after « · ».
      return text(sentence.key, { first, second: second ? lowerFirst(second) : '' });
    },
    [discovery, reference, locale],
  );
}
