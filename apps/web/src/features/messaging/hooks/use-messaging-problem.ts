'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** Stable code of a refusal of the api, or null for a failure of the network. */
export function problemCode(error: unknown): string | null {
  return error instanceof ApiProblemError ? error.problem.code : null;
}

/** The api answers 404: the resource does not exist for the reader. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiProblemError && error.problem.status === 404;
}

/** The sentence of a refusal of the api (`errors.<code>`), never its technical message. */
export function useMessagingProblem(): (error: unknown) => string {
  const errors = useTranslations('errors');
  return useCallback(
    (error: unknown) => {
      const code = problemCode(error) ?? 'INTERNAL_ERROR';
      return errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR');
    },
    [errors],
  );
}
