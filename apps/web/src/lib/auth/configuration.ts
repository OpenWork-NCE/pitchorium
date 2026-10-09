import 'server-only';
import {
  type AuthConfigurationDtoOutput,
  accountControllerAuthConfiguration,
} from '@pitchorium/api-client';
import { cache } from 'react';
import { configureServerApi } from '@/lib/api/server';

/**
 * What the sign-in screens show before any session (`GET /v1/auth-configuration`, ADR 0103):
 * OAuth providers enabled, Turnstile, legal versions. Read once per request, cached a minute by
 * the api.
 */
export const getAuthConfiguration = cache(async (): Promise<AuthConfigurationDtoOutput> => {
  configureServerApi();
  return accountControllerAuthConfiguration({ next: { revalidate: 60 } });
});
