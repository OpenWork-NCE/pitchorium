'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * The text of a refusal of the api for an event, from its stable code (`errors.<code>`, never its
 * technical message), with the precise reason of a schedule refused (ADR 0106).
 */
export function useEventProblem(): (error: unknown) => string {
  const errors = useTranslations('errors');
  const forms = useTranslations('web.forms.problems');
  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiProblemError)) return errors('INTERNAL_ERROR');
      const { code } = error.problem;
      const reason = (error.problem as { reason?: unknown }).reason;
      const precise = typeof reason === 'string' ? `${code}.${reason}` : null;
      if (precise && forms.has(precise as never)) return forms(precise as never);
      return errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR');
    },
    [errors, forms],
  );
}
