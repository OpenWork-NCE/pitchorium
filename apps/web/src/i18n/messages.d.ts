import type { Locale } from '@pitchorium/contracts';
import type common from '@pitchorium/i18n/locales/fr/common.json';
import type errors from '@pitchorium/i18n/locales/fr/errors.json';
import type notifications from '@pitchorium/i18n/locales/fr/notifications.json';
import type reference from '@pitchorium/i18n/locales/fr/reference.json';
import type web from '@pitchorium/i18n/locales/fr/web.json';

/** Keys checked at compile time against the French source catalogues. */
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: {
      common: typeof common;
      errors: typeof errors;
      notifications: typeof notifications;
      reference: typeof reference;
      web: typeof web;
    };
  }
}
