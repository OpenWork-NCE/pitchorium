/** A country of a list: its ISO 3166-1 code and its name in the language of the page. */
export interface CountryOption {
  value: string;
  label: string;
}

/**
 * Countries named by the browser in the language of the page (`Intl.DisplayNames`), sorted by
 * name: the same names as the `reference.countries` catalogue, whose labels are the ones of
 * `Intl`, without shipping that catalogue to the browser.
 */
export function countryOptions(codes: readonly string[], locale: string): CountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' });
  return codes
    .map((code) => ({ value: code, label: names.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

/** Name of one country in the language of the page. */
export function countryName(code: string, locale: string): string {
  return new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' }).of(code) ?? code;
}
