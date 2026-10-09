/**
 * Plural category of a count in a language, `one` or `other`: the catalogues hold the two forms
 * under these keys (their `{{name}}` parameters have no ICU plural, ADR 0084). French says
 * "0 jour", English "0 days". For the server; `usePlural` in the browser.
 */
export function pluralOf(locale: string, count: number): 'one' | 'other' {
  return new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other';
}
