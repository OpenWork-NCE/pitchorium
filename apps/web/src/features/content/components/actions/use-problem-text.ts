'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** The text of a refusal of the api (`errors.<code>`), never its technical message. */
export function useProblemText(): (error: unknown) => string {
  const errors = useTranslations('errors');
  return useCallback(
    (error: unknown) => {
      const code = error instanceof ApiProblemError ? error.problem.code : 'INTERNAL_ERROR';
      return errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR');
    },
    [errors],
  );
}
