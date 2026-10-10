/** Names of countries in the language of the page (Intl), in the order the api gives them. */
export function countryNames(codes: readonly string[], locale: string): string[] {
  const names = new Intl.DisplayNames(locale, { type: 'region' });
  return codes.map((code) => names.of(code) ?? code);
}
