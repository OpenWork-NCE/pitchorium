import type { Locale, SuggestionSentence } from '@pitchorium/contracts';
import { translate } from './translate.js';

/** Parameters of a reason that are codes of labelled values, and the group of their label. */
const LABELLED_PARAMS: Readonly<Record<string, string>> = {
  need: 'entrepreneurNeeds',
  hat: 'contributorHats',
  sector: 'sectors',
  instrument: 'fundingInstruments',
};

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

function labelled(locale: Locale, params: Readonly<Record<string, string>>) {
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    const group = LABELLED_PARAMS[name];
    if (group) values[name] = lowerFirst(translate(locale, 'reference', `${group}.${value}`));
    else if (name === 'country')
      values[name] = translate(locale, 'reference', `countries.${value}`);
    else if (name === 'language') {
      values[name] = new Intl.DisplayNames([locale], { type: 'language' }).of(value) ?? value;
    } else values[name] = value;
  }
  return values;
}

/**
 * Reason sentence of a suggestion (discovery module, ADR 0067) in a locale: « Suggéré parce que
 * vous cherchez « mentorat » et Amina est mentor et que Amina intervient dans votre pays,
 * Sénégal ». Codes of needs, hats, sectors, instruments, countries and languages are labelled.
 */
export function suggestionSentenceText(locale: Locale, sentence: SuggestionSentence): string {
  const [first, second] = sentence.clauses.map((clause) =>
    translate(locale, 'discovery', clause.key, labelled(locale, clause.params)),
  );
  return translate(locale, 'discovery', sentence.key, {
    first: first ?? '',
    second: second ?? '',
  });
}
