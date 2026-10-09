/**
 * Lower-case first letter of a label used in the middle of a sentence (« Photo de couverture »
 * becomes « photo de couverture »); an acronym or a name with a capital inside its first word
 * (« KYC », « LinkedIn ») keeps its case.
 */
export function inSentence(label: string, locale: string): string {
  const firstWord = label.split(' ')[0] ?? '';
  if (/\p{Lu}/u.test(firstWord.slice(1))) return label;
  return label.charAt(0).toLocaleLowerCase(locale) + label.slice(1);
}

/**
 * A list in the middle of a sentence, in the language of the page (Intl.ListFormat: « photo et
 * photo de couverture », « photo, title and links »), its labels in lower case.
 */
export function formatList(
  labels: readonly string[],
  locale: string,
  type: 'conjunction' | 'disjunction' = 'conjunction',
): string {
  return new Intl.ListFormat(locale, { type }).format(
    labels.map((label) => inSentence(label, locale)),
  );
}
