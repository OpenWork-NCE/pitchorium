/**
 * Filters of the page of the notifications (§10.5): every notification, or one family whose
 * types the api decides (`family` of `GET /v1/me/notifications`). Copied from the contracts
 * (`NOTIFICATION_FAMILIES`), kept equal by families.spec.ts.
 */
export const NOTIFICATION_FILTERS = ['all', 'mentions', 'network', 'posts', 'projects'] as const;
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];
