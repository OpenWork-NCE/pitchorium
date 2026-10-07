import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AdminBootstrapService } from '../../src/modules/access';
import { createApiTestApp } from './support/api-app';
import { AccessProbeController, OwnProjectResolver } from './support/access-probe.controller';
import { query, truncateAllTables } from './support/database';
import {
  type Agent,
  browser,
  createMember,
  PASSWORD,
  signIn,
  twoFactorRequest,
} from './support/members';
import { totp } from './support/totp';

const auditOf = (action: string) =>
  query<{ actor_id: string | null; target_id: string; metadata: Record<string, unknown> }>(
    'SELECT actor_id, target_id, metadata FROM platform.audit_log WHERE action = $1',
    [action],
  );

describe('access', () => {
  let app: NestExpressApplication;
  let bootstrap: AdminBootstrapService;

  beforeAll(async () => {
    ({ app } = await createApiTestApp(
      [AccessProbeController],
      {},
      {
        providers: [OwnProjectResolver],
      },
    ));
    bootstrap = app.get(AdminBootstrapService, { strict: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('deny by default', () => {
    it('requires a session, then a declared action', async () => {
      await request(app.getHttpServer()).get('/v1/test-access/undeclared').expect(401);
      const member = await createMember(app, 'member@example.com');
      const response = await member.agent.get('/v1/test-access/undeclared').expect(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  describe('prerequisites', () => {
    it('lists every missing element and fails the action with a stable code', async () => {
      const newcomer = await createMember(app, 'newcomer@example.com', {
        verified: false,
        legal: false,
      });

      const before = await newcomer.agent.get('/v1/me/prerequisites/project.publish').expect(200);
      expect(before.body).toEqual({
        action: 'project.publish',
        allowed: false,
        code: 'ACCESS_PREREQUISITES_MISSING',
        missing: ['email_verified', 'profile.entrepreneur_facet', 'legal_acceptance'],
      });

      const refused = await newcomer.agent.post('/v1/test-access/publish').send({}).expect(403);
      expect(refused.body).toMatchObject({
        code: 'ACCESS_PREREQUISITES_MISSING',
        missing: ['email_verified', 'profile.entrepreneur_facet', 'legal_acceptance'],
      });
      expect(await auditOf('access.action-denied')).toEqual([
        expect.objectContaining({
          actor_id: newcomer.userId,
          metadata: expect.objectContaining({ action: 'project.publish' }) as object,
        }),
      ]);

      const entrepreneur = await createMember(app, 'entrepreneur@example.com');
      await entrepreneur.agent
        .post('/v1/me/profile/entrepreneur-facet')
        .set('Idempotency-Key', 'facet-1')
        .send({
          companyName: 'Sahel Agri',
          sectorCode: 'agriculture_forestry_fishing',
          stageCode: 'idea',
          companyCountryCode: 'SN',
        })
        .expect(201);
      await entrepreneur.agent.post('/v1/test-access/publish').send({}).expect(201);
    });

    it('answers 400 for an unknown action', async () => {
      const member = await createMember(app, 'member@example.com');
      const response = await member.agent.get('/v1/me/prerequisites/rocket.launch').expect(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('administrators', () => {
    async function enableTwoFactor(agent: Agent): Promise<string> {
      const enabled = await twoFactorRequest(() =>
        agent.post('/v1/auth/two-factor/enable').send({ password: PASSWORD }),
      );
      expect(enabled.status, JSON.stringify(enabled.body)).toBe(200);
      const uri = enabled.body.totpURI as string;
      const verified = await twoFactorRequest(() =>
        agent.post('/v1/auth/two-factor/verify-totp').send({ code: totp(uri) }),
      );
      expect(verified.status).toBe(200);
      return uri;
    }

    it('creates the first admin from the command line only, idempotently', async () => {
      const admin = await createMember(app, 'admin@example.com');

      expect(await bootstrap.ensureAdmin('admin@example.com')).toBe('granted');
      expect(await bootstrap.ensureAdmin('ADMIN@example.com')).toBe('already-admin');
      await expect(bootstrap.ensureAdmin('ghost@example.com')).rejects.toMatchObject({
        code: 'IDENTITY_USER_NOT_FOUND',
      });

      // The new privilege applies to fresh sessions only.
      await admin.agent.get('/v1/me').expect(401);
      expect(await auditOf('access.role-granted')).toEqual([
        expect.objectContaining({ actor_id: null, target_id: admin.userId }),
      ]);
      const events = await query<{ event_type: string; payload: Record<string, unknown> }>(
        `SELECT event_type, payload FROM platform.outbox_events
         WHERE event_type IN ('access.role.granted.v1', 'identity.user.sessions-revoked.v1')
         ORDER BY occurred_at`,
      );
      expect(events).toEqual([
        { event_type: 'access.role.granted.v1', payload: { role: 'admin', grantedBy: null } },
        {
          event_type: 'identity.user.sessions-revoked.v1',
          payload: { scope: 'all', reason: 'privilege_change' },
        },
      ]);
    });

    it('requires two-factor authentication before any admin action', async () => {
      const admin = await createMember(app, 'admin@example.com');
      const target = await createMember(app, 'target@example.com');
      await bootstrap.ensureAdmin('admin@example.com');
      const agent = browser(app);
      await signIn(agent, 'admin@example.com');

      const refused = await agent.get(`/v1/access/users/${target.userId}/roles`).expect(403);
      expect(refused.body).toMatchObject({
        code: 'ACCESS_PREREQUISITES_MISSING',
        missing: ['two_factor'],
      });

      const uri = await enableTwoFactor(agent);
      await agent.get(`/v1/access/users/${target.userId}/roles`).expect(200);

      // A new sign-in now needs the second factor before any session exists.
      const laptop = browser(app);
      const firstStep = await laptop
        .post('/v1/auth/sign-in/email')
        .send({ email: 'admin@example.com', password: PASSWORD })
        .expect(200);
      expect(firstStep.body).toMatchObject({ twoFactorRedirect: true });
      await laptop.get('/v1/me').expect(401);
      const second = await twoFactorRequest(() =>
        laptop.post('/v1/auth/two-factor/verify-totp').send({ code: totp(uri) }),
      );
      expect(second.status).toBe(200);

      const granted = await laptop
        .post(`/v1/access/users/${target.userId}/roles`)
        .set('Idempotency-Key', 'grant-1')
        .send({ role: 'moderator' })
        .expect(201);
      expect(granted.body.assignments).toEqual([
        expect.objectContaining({ role: 'moderator', grantedBy: admin.userId }),
      ]);
      await target.agent.get('/v1/me').expect(401);

      const lastAdmin = await laptop
        .delete(`/v1/access/users/${admin.userId}/roles/admin`)
        .expect(409);
      expect(lastAdmin.body.code).toBe('ACCESS_LAST_ADMIN');
    });

    it('forbids role management to members', async () => {
      const member = await createMember(app, 'member@example.com');
      const response = await member.agent
        .get(`/v1/access/users/${member.userId}/roles`)
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });
});
