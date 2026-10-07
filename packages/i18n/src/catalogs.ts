import type { Locale } from '@pitchorium/contracts';
import fr_common from './locales/fr/common.json' with { type: 'json' };
import fr_errors from './locales/fr/errors.json' with { type: 'json' };
import fr_emails from './locales/fr/emails.json' with { type: 'json' };
import en_common from './locales/en/common.json' with { type: 'json' };
import en_errors from './locales/en/errors.json' with { type: 'json' };
import en_emails from './locales/en/emails.json' with { type: 'json' };
import sw_common from './locales/sw/common.json' with { type: 'json' };
import sw_errors from './locales/sw/errors.json' with { type: 'json' };
import sw_emails from './locales/sw/emails.json' with { type: 'json' };
import wo_common from './locales/wo/common.json' with { type: 'json' };
import wo_errors from './locales/wo/errors.json' with { type: 'json' };
import wo_emails from './locales/wo/emails.json' with { type: 'json' };
import ln_common from './locales/ln/common.json' with { type: 'json' };
import ln_errors from './locales/ln/errors.json' with { type: 'json' };
import ln_emails from './locales/ln/emails.json' with { type: 'json' };

export const NAMESPACES = ['common', 'errors', 'emails'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export type CatalogTree = { [key: string]: string | CatalogTree };

export const catalogs: Record<Locale, Record<Namespace, CatalogTree>> = {
  fr: { common: fr_common, errors: fr_errors, emails: fr_emails },
  en: { common: en_common, errors: en_errors, emails: en_emails },
  sw: { common: sw_common, errors: sw_errors, emails: sw_emails },
  wo: { common: wo_common, errors: wo_errors, emails: wo_emails },
  ln: { common: ln_common, errors: ln_errors, emails: ln_emails },
};
