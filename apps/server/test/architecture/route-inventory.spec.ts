import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeActionPolicy } from '../../src/modules/access/interface/action-documentation';

interface Operation {
  'x-access'?: string;
  security?: unknown[];
}

const DOCUMENT = JSON.parse(
  readFileSync(join(__dirname, '../../openapi/openapi.json'), 'utf8'),
) as { paths: Record<string, Record<string, Operation>> };

const ROUTES = Object.entries(DOCUMENT.paths).flatMap(([path, operations]) =>
  Object.entries(operations).map(([method, operation]) => ({
    route: `${method.toUpperCase()} ${path}`,
    access: operation['x-access'],
    operation,
  })),
);

/**
 * Routes reachable without a session, reviewed one by one (docs/security/review.md). A new
 * public route fails this test until it is added here on purpose.
 */
const PUBLIC_ROUTES = [
  'GET /v1/health/live',
  'GET /v1/health/ready',
  'GET /v1/legal-documents/current',
  'GET /v1/auth-configuration',
  'GET /v1/locales',
  'GET /v1/reference-data',
  'GET /v1/media/usages',
  'GET /v1/impact/methodology',
  'GET /v1/public/profiles/{handle}',
  'GET /v1/public/organizations/{slug}',
  // Pages of the sitemap: the profiles whose public page is open, the organisations (ADR 0101).
  'GET /v1/public/profiles',
  'GET /v1/public/organizations',
  'GET /v1/public/network/members/{handle}/followers',
  'GET /v1/public/network/members/{handle}/following',
  'GET /v1/public/network/members/{handle}/connections',
  'GET /v1/public/posts/{postId}',
  'GET /v1/public/projects',
  'GET /v1/public/projects/{slug}',
  'GET /v1/public/projects/{projectId}/posts',
  'GET /v1/public/projects/{projectId}/updates',
  'GET /v1/public/projects/{projectId}/supporters',
  'GET /v1/public/events',
  'GET /v1/public/events/{slug}',
  'GET /v1/public/events/{slug}/ics',
  // Personal calendar feed: the unguessable token is the credential (events README).
  'GET /v1/calendars/{token}',
  'GET /v1/public/missions',
  'GET /v1/public/missions/{missionId}',
  'GET /v1/public/discovery/search',
  'GET /v1/public/discovery/autocomplete',
  'GET /v1/public/discovery/page',
  'GET /v1/public/discovery/sections/{section}',
  // One-click unsubscribe (RFC 8058): the signed token authenticates the request.
  'POST /v1/notifications/unsubscribe',
  // Notices of illegal content from anyone (DSA article 16), rate limited.
  'POST /v1/public/reports',
  // What an invitation received by email invites to: a read, the token in the body rather than
  // in an address, never the invited address (organizations README).
  'POST /v1/public/organization-invitations/preview',
];

describe('route inventory', () => {
  it('gives every route an access: public on purpose, or an action', () => {
    expect(ROUTES.filter(({ access }) => !access || access === 'none')).toEqual([]);
  });

  it('keeps the public routes to the reviewed list', () => {
    const publicRoutes = ROUTES.filter(({ access }) => access === 'public').map(
      ({ route }) => route,
    );
    expect(publicRoutes.sort()).toEqual([...PUBLIC_ROUTES].sort());
  });

  it('only lets the public routes read, except the reviewed writes', () => {
    const writes = ROUTES.filter(
      ({ access, route }) => access === 'public' && !route.startsWith('GET '),
    ).map(({ route }) => route);
    expect(writes.sort()).toEqual([
      'POST /v1/notifications/unsubscribe',
      'POST /v1/public/organization-invitations/preview',
      'POST /v1/public/reports',
    ]);
  });

  it('protects every other route with the session and a known action policy', () => {
    for (const { route, access, operation } of ROUTES) {
      if (access === 'public') continue;
      expect(operation.security, route).toBeDefined();
      expect(describeActionPolicy(access ?? ''), `${route}: ${access}`).toBeDefined();
    }
  });

  it('reserves the back office to privileged roles', () => {
    const open = ROUTES.filter(({ route }) => / \/v1\/admin\//.test(route))
      .filter(({ access }) => (describeActionPolicy(access ?? '')?.roles.length ?? 0) === 0)
      .map(({ route, access }) => `${route}: ${access}`);
    expect(open).toEqual([]);
  });
});
