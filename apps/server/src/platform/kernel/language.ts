import { franc } from 'franc-min';

/**
 * The languages of the contents Pitchorium addresses (§8.2), by their ISO 639-3 code in franc-min
 * mapped to ISO 639-1: French, English, Swahili, Lingala. Wolof is not detected by franc-min.
 * Any other language, real or a misreading of a short or unusual text (an identifier, a list of
 * names), stays undetermined: no translation is offered that no provider could make.
 */
const ISO_639_1: Readonly<Record<string, string>> = {
  eng: 'en',
  fra: 'fr',
  lin: 'ln',
  swh: 'sw',
};

/**
 * Language of a text (ISO 639-1) among those of the platform, by statistical detection
 * (trigrams); null when undetermined or another language, and for texts under 10 characters.
 * Shared by the modules that show user contents: the interface offers their translation only in
 * another language than its own (§8.3).
 */
export function detectLanguage(text: string | null | undefined): string | null {
  if (!text) return null;
  return ISO_639_1[franc(text, { minLength: 10 })] ?? null;
}
