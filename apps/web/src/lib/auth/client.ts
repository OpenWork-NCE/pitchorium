import { magicLinkClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { publicEnv } from '@/lib/public-env';

/**
 * Better Auth client on `/v1/auth` of the api (frontend handoff): the session is the HttpOnly
 * cookie of the api, never read nor stored by JavaScript. The time zone of the browser goes
 * with every call; the api keeps it at sign-up.
 */
export const authClient = createAuthClient({
  baseURL: `${publicEnv.apiUrl}/v1/auth`,
  plugins: [twoFactorClient(), magicLinkClient()],
  fetchOptions: {
    credentials: 'include',
    headers:
      typeof window === 'undefined'
        ? {}
        : { 'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone },
  },
});
