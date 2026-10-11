/**
 * Query key of the counters of the member (`GET /v1/me/counters`), the value of
 * `getNotificationsControllerCountersQueryKey()` (checked by keys.spec.ts). Many islands invalidate
 * the counters after an action: importing the generated function brought the whole notifications
 * tag of the api client into each of their chunks (ADR 0094).
 */
export const COUNTERS_QUERY_KEY = ['/v1/me/counters'] as const;
