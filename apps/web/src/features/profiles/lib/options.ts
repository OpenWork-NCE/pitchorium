import { CURRENCY_EXPONENTS } from '@pitchorium/contracts';

/** An option of a list: a code and its name in the language of the page. */
export interface NamedOption {
  value: string;
  label: string;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

let isoLanguages: string[] | undefined;

/**
 * The ISO 639-1 codes the api accepts: those `Intl` can name (the rule of `languageCodeSchema`),
 * found once among the 676 pairs of letters rather than written in a list of our own.
 */
function languageCodes(): string[] {
  if (isoLanguages) return isoLanguages;
  const names = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
  isoLanguages = [...LETTERS].flatMap((first) =>
    [...LETTERS]
      .map((second) => `${first}${second}`)
      .filter((code) => names.of(code) !== undefined),
  );
  return isoLanguages;
}

const sorted = (options: NamedOption[], locale: string) =>
  options.sort((a, b) => a.label.localeCompare(b.label, locale));

/** Name of a language in the language of the page (« wolof », « swahili »). */
export function languageName(code: string, locale: string): string {
  return new Intl.DisplayNames([locale], { type: 'language', fallback: 'code' }).of(code) ?? code;
}

export function languageOptions(locale: string): NamedOption[] {
  return sorted(
    languageCodes().map((code) => ({ value: code, label: languageName(code, locale) })),
    locale,
  );
}

/** The currencies the api accepts (`CURRENCY_EXPONENTS`), named in the language of the page. */
export function currencyOptions(locale: string): NamedOption[] {
  const names = new Intl.DisplayNames([locale], { type: 'currency', fallback: 'code' });
  return sorted(
    [...CURRENCY_EXPONENTS.keys()].map((code) => ({
      value: code,
      label: `${names.of(code) ?? code} (${code})`,
    })),
    locale,
  );
}
