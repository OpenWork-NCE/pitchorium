import type { Notification } from '@pitchorium/contracts';

/**
 * Pages of the web app a notification may open: the path comes from the api (`pathOf`, the same
 * in the emails); one of a page not delivered yet (reports, moderation, personal data) is never
 * a link (AGENTS.md: no link to a page not delivered). The events and the engagements of the
 * missions are delivered (FRONT 7, question 132).
 */
const DELIVERED = [
  /^\/members\/[^/?]+$/,
  /^\/posts\/[^/?]+$/,
  /^\/messages(\/[^/?]+)?(\?filter=requests)?$/,
  /^\/introductions\/[^/?]+$/,
  /^\/projects(\/[^/?]+)?$/,
  /^\/organizations\/[^/?]+$/,
  /^\/contributions\/[^/?]+$/,
  /^\/events\/[^/?]+$/,
  /^\/missions\/engagements\/[^/?]+$/,
  /^\/settings\/(payouts|security|privacy)$/,
  /^\/dashboard(\/time)?$/,
  /^\/network(\/profile-views|\/invitations|\?view=suggestions)?$/,
] as const;

/** Where the notification leads, or null when its page is not delivered yet. */
export function targetHref(target: Notification['target']): string | null {
  return DELIVERED.some((pattern) => pattern.test(target.path)) ? target.path : null;
}
