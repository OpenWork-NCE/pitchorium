import type { Locale } from '@pitchorium/contracts';
import fr_common from './locales/fr/common.json' with { type: 'json' };
import fr_errors from './locales/fr/errors.json' with { type: 'json' };
import fr_emails from './locales/fr/emails.json' with { type: 'json' };
import fr_reference from './locales/fr/reference.json' with { type: 'json' };
import fr_notifications from './locales/fr/notifications.json' with { type: 'json' };
import en_common from './locales/en/common.json' with { type: 'json' };
import en_errors from './locales/en/errors.json' with { type: 'json' };
import en_emails from './locales/en/emails.json' with { type: 'json' };
import en_reference from './locales/en/reference.json' with { type: 'json' };
import en_notifications from './locales/en/notifications.json' with { type: 'json' };
import sw_common from './locales/sw/common.json' with { type: 'json' };
import sw_errors from './locales/sw/errors.json' with { type: 'json' };
import sw_emails from './locales/sw/emails.json' with { type: 'json' };
import sw_reference from './locales/sw/reference.json' with { type: 'json' };
import sw_notifications from './locales/sw/notifications.json' with { type: 'json' };
import wo_common from './locales/wo/common.json' with { type: 'json' };
import wo_errors from './locales/wo/errors.json' with { type: 'json' };
import wo_emails from './locales/wo/emails.json' with { type: 'json' };
import wo_reference from './locales/wo/reference.json' with { type: 'json' };
import wo_notifications from './locales/wo/notifications.json' with { type: 'json' };
import ln_common from './locales/ln/common.json' with { type: 'json' };
import ln_errors from './locales/ln/errors.json' with { type: 'json' };
import ln_emails from './locales/ln/emails.json' with { type: 'json' };
import ln_reference from './locales/ln/reference.json' with { type: 'json' };
import ln_notifications from './locales/ln/notifications.json' with { type: 'json' };

export const NAMESPACES = ['common', 'errors', 'emails', 'reference', 'notifications'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export type CatalogTree = { [key: string]: string | CatalogTree };

export const catalogs: Record<Locale, Record<Namespace, CatalogTree>> = {
  fr: {
    common: fr_common,
    errors: fr_errors,
    emails: fr_emails,
    reference: fr_reference,
    notifications: fr_notifications,
  },
  en: {
    common: en_common,
    errors: en_errors,
    emails: en_emails,
    reference: en_reference,
    notifications: en_notifications,
  },
  sw: {
    common: sw_common,
    errors: sw_errors,
    emails: sw_emails,
    reference: sw_reference,
    notifications: sw_notifications,
  },
  wo: {
    common: wo_common,
    errors: wo_errors,
    emails: wo_emails,
    reference: wo_reference,
    notifications: wo_notifications,
  },
  ln: {
    common: ln_common,
    errors: ln_errors,
    emails: ln_emails,
    reference: ln_reference,
    notifications: ln_notifications,
  },
};
