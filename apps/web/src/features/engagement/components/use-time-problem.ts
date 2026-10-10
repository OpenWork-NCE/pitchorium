'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';

/** The text of a refusal of the engagement api (`errors.<code>`), or of a lost connection. */
export function useProblem() {
  const errors = useTranslations('errors');
  const t = useTranslations('web.engagement.time');
  return (error: unknown) =>
    error instanceof ApiProblemError
      ? errors.has(error.problem.code as never)
        ? errors(error.problem.code as never)
        : errors('INTERNAL_ERROR')
      : t('network');
}
