'use client';

import type { Action } from '@pitchorium/contracts';
import {
  accessControllerPrerequisites,
  getAccessControllerPrerequisitesQueryKey,
} from '@pitchorium/api-client';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { formatList } from '@/lib/format/list';
import { useCachedData } from '@/lib/query/use-cached-data';

export interface Access {
  /** Indicative: the api decides on every call (ACCESS_PREREQUISITES_MISSING otherwise). */
  allowed: boolean;
  /** Still asking the api. */
  pending: boolean;
  /** What the member still has to complete, translated, for a disabled reason. */
  reason: string | undefined;
  missing: readonly string[];
}

/**
 * Prerequisites of an action for the current member (`GET /v1/me/prerequisites/{action}`):
 * whether it would be allowed and what is missing (email, legal acceptance, KYC...). An
 * indication for the interface only.
 */
export function useAccess(action: Action): Access {
  const t = useTranslations('reference.prerequisiteElements');
  const shell = useTranslations('web.access');
  const errors = useTranslations('errors');
  const locale = useLocale();
  // Read without a query observer (useCachedData): the shell of every page of the member space
  // asks it, and the observer would be copied into its chunk (ADR 0094).
  const data = useCachedData({
    queryKey: getAccessControllerPrerequisitesQueryKey(action),
    queryFn: ({ signal }) => accessControllerPrerequisites(action, { signal }),
    initialData: null,
    staleTime: 30_000,
  });
  const query = { data, isPending: data === undefined };
  const missing = query.data?.missing ?? [];
  return {
    allowed: query.data?.allowed ?? true,
    pending: query.isPending,
    reason:
      missing.length > 0
        ? shell('missing', {
            list: formatList(
              missing.map((element) => t(element)),
              locale,
            ),
          })
        : query.data && !query.data.allowed
          ? // The refusal the api names (a suspended account, ACCESS_ACCOUNT_SUSPENDED), in words.
            query.data.code && errors.has(query.data.code as never)
            ? errors(query.data.code as never)
            : shell('denied')
          : undefined,
    missing,
  };
}

interface CanProps {
  action: Action;
  /**
   * `hide`: nothing while not allowed (nor while asking); `disable`: the children get the access
   * and show the action disabled with its reason.
   */
  mode?: 'hide' | 'disable';
  /** Shown instead, in `hide` mode. */
  fallback?: ReactNode;
  children: ReactNode | ((access: Access) => ReactNode);
}

/** Shows, hides or disables an action according to its prerequisites (useAccess). */
export function Can({ action, mode = 'disable', fallback = null, children }: CanProps) {
  const access = useAccess(action);
  if (mode === 'hide' && (access.pending || !access.allowed)) return fallback;
  return typeof children === 'function' ? children(access) : children;
}
