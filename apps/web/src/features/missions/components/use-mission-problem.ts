'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { MISSION_MAX_HOURS } from '../lib/limits';
import { missionRefusal } from '../lib/refusals';

/**
 * The text of a refusal of the api for a mission: a refusal about its volunteer nature explains
 * the rule (`web.missions.refusals`, ADR 0071); any other says its code (`errors.<code>`).
 */
export function useMissionProblem(): (error: unknown) => string {
  const errors = useTranslations('errors');
  const refusals = useTranslations('web.missions.refusals');
  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiProblemError)) return errors('INTERNAL_ERROR');
      const refusal = missionRefusal(error.problem.code);
      if (refusal) {
        return refusals(refusal, {
          session: MISSION_MAX_HOURS.session,
          short: MISSION_MAX_HOURS.short_mission,
        });
      }
      const code = error.problem.code;
      return errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR');
    },
    [errors, refusals],
  );
}
