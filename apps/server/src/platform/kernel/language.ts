import { franc } from 'franc-min';

/**
 * ISO 639-3 codes returned by franc-min mapped to ISO 639-1; languages without a 639-1 code
 * (Bhojpuri, Cebuano...) stay undetermined. Wolof is not detected by franc-min.
 */
const ISO_639_1: Readonly<Record<string, string>> = {
  arb: 'ar',
  azj: 'az',
  bel: 'be',
  bos: 'bs',
  bul: 'bg',
  ces: 'cs',
  deu: 'de',
  eng: 'en',
  fra: 'fr',
  fuv: 'ff',
  hau: 'ha',
  hin: 'hi',
  hrv: 'hr',
  hun: 'hu',
  ibo: 'ig',
  ind: 'id',
  ita: 'it',
  jav: 'jv',
  kaz: 'kk',
  kin: 'rw',
  lin: 'ln',
  mar: 'mr',
  nld: 'nl',
  npi: 'ne',
  nya: 'ny',
  pbu: 'ps',
  pes: 'fa',
  plt: 'mg',
  pol: 'pl',
  por: 'pt',
  ron: 'ro',
  run: 'rn',
  rus: 'ru',
  som: 'so',
  spa: 'es',
  srp: 'sr',
  sun: 'su',
  swe: 'sv',
  swh: 'sw',
  tgl: 'tl',
  tur: 'tr',
  ukr: 'uk',
  urd: 'ur',
  uzn: 'uz',
  vie: 'vi',
  yor: 'yo',
  zlm: 'ms',
  zul: 'zu',
};

/**
 * Language of a text (ISO 639-1), by statistical detection (trigrams); null when undetermined,
 * and for texts under 10 characters. Shared by the modules that show user contents: the
 * interface offers their translation only in another language than its own (§8.3).
 */
export function detectLanguage(text: string | null | undefined): string | null {
  if (!text) return null;
  return ISO_639_1[franc(text, { minLength: 10 })] ?? null;
}
