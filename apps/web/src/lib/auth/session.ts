import 'server-only';
import { ApiProblemError, type CurrentUserDtoOutput, meControllerMe } from '@pitchorium/api-client';
import { cache } from 'react';
import { configureServerApi } from '@/lib/api/server';

/**
 * Member of the incoming request (`GET /v1/me`), null without a valid session. Read once per
 * request; the proxy has only checked that a cookie exists.
 */
export const getCurrentMember = cache(async (): Promise<CurrentUserDtoOutput | null> => {
  configureServerApi();
  try {
    return await meControllerMe({ cache: 'no-store' });
  } catch (error) {
    if (error instanceof ApiProblemError && error.problem.status === 401) return null;
    throw error;
  }
});
