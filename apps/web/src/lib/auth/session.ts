import 'server-only';
import { ApiProblemError, type CurrentUserDtoOutput, meControllerMe } from '@pitchorium/api-client';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { SESSION_COOKIES } from '@/config/routes';
import { configureServerApi } from '@/lib/api/server';

/**
 * Member of the incoming request (`GET /v1/me`), null without a valid session. Read once per
 * request; without a session cookie (a visitor of a public page), the api is not asked.
 */
export const getCurrentMember = cache(async (): Promise<CurrentUserDtoOutput | null> => {
  const store = await cookies();
  if (!SESSION_COOKIES.some((name) => store.has(name))) return null;
  configureServerApi();
  try {
    return await meControllerMe({ cache: 'no-store' });
  } catch (error) {
    if (error instanceof ApiProblemError && error.problem.status === 401) return null;
    throw error;
  }
});
