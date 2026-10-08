import { z } from 'zod';
import { LOCALES } from './locales.js';

export { DEFAULT_LOCALE, type Locale, LOCALES } from './locales.js';

export const localeSchema = z.enum(LOCALES);
