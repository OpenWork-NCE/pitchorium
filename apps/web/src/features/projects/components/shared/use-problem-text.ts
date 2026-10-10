'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * The text of a refusal of the api (`errors.<code>`, never its technical message), or of a lost
 * connection, for the actions of a project outside a form.
 */
export function useProblemText(): (error: unknown) => string {
  const errors = useTranslations('errors');
  const t = useTranslations('web.projects.editor');
  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiProblemError)) return t('networkFailure');
      const code = error.problem.code;
      return errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR');
    },
    [errors, t],
  );
}
