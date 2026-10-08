/**
 * Interface locales, without validation library: imported as is by the clients (the browser
 * bundle of the web app stays free of Zod); the schema lives in locale.ts.
 */
export const LOCALES = ['fr', 'en', 'sw', 'wo', 'ln'] as const;

export const DEFAULT_LOCALE = 'fr';

export type Locale = (typeof LOCALES)[number];
