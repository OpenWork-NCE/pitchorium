import manifest from './locales/manifest.json' with { type: 'json' };

export { catalogs, NAMESPACES, type CatalogTree, type Namespace } from './catalogs.js';
export { translate, type TranslationParams } from './translate.js';

export type ReviewStatus = 'source' | 'reviewed' | 'pending-review' | 'empty';

export const localeManifest = manifest as {
  sourceLocale: string;
  fallbackLocale: string;
  locales: Record<
    string,
    { status: ReviewStatus; reviewedBy: string | null; reviewedAt: string | null }
  >;
};
export { suggestionSentenceText } from './suggestions.js';
