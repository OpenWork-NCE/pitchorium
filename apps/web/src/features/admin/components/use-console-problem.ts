'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * The text of a refusal of the api in the console: the message of its code (`errors.<code>`),
 * never its technical message; a lost connection says so.
 */
export function useConsoleProblem(): (error: unknown) => string {
  const errors = useTranslations('errors');
  const t = useTranslations('web.admin.common');
  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiProblemError)) return t('network');
      const { code } = error.problem;
      return errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR');
    },
    [errors, t],
  );
}

/** The code of a refusal of the api, null for anything else (a lost connection). */
export function problemCodeOf(error: unknown): string | null {
  return error instanceof ApiProblemError ? error.problem.code : null;
}
