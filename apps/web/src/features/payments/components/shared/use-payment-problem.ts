'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * The text of a refusal of the payments api (ADR 0106, ADR 0138): the message of its precise
 * reason when the code has several (`web.payments.problems.<code>.<reason>`), else the message
 * of the code (`errors.<code>`), never the technical message of the api; a lost connection says
 * so.
 */
export function usePaymentProblem(): (error: unknown) => string {
  const errors = useTranslations('errors');
  const problems = useTranslations('web.payments.problems');
  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiProblemError)) return problems('network');
      const { code, reason } = error.problem;
      const precise = reason ? `${code}.${reason}` : null;
      if (precise && problems.has(precise as never)) return problems(precise as never);
      return errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR');
    },
    [errors, problems],
  );
}

/** The code of a refusal of the api, null for anything else (a lost connection). */
export function problemCode(error: unknown): string | null {
  return error instanceof ApiProblemError ? error.problem.code : null;
}
