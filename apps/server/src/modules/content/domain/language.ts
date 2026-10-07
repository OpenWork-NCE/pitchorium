import type { LanguageSource } from '@pitchorium/contracts';

/** Language stored with a publication, for translation on demand (localization module). */
export function resolveLanguage(
  declared: string | null | undefined,
  detected: string | null,
): { language: string | null; languageSource: LanguageSource } {
  if (declared) return { language: declared, languageSource: 'declared' };
  if (detected) return { language: detected, languageSource: 'detected' };
  return { language: null, languageSource: 'undetermined' };
}
