/**
 * Public facade of the localization feature: languages offered to the visitor and the member, and
 * the machine translation of a content on demand (§8.3).
 */
export { ActiveLocalesProvider, useActiveLocales } from './components/active-locales';
export { LocaleSwitcher } from './components/locale-switcher';
export { useMemberLocaleChange } from './components/member-locale';
export {
  Translatable,
  Translated,
  type TranslationSource,
  useTranslationOffered,
} from './components/translate';
