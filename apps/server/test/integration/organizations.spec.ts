import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { IdentityModule } from '../../src/modules/identity';
import { MediaModule } from '../../src/modules/media';
import { MalwareScanner } from '../../src/modules/media/application/ports';
import { NetworkModule } from '../../src/modules/network';
import { OrganizationsModule } from '../../src/modules/organizations';
import { ProfilesModule } from '../../src/modules/profiles';
import { AuditModule } from '../../src/platform/audit';
import { FeatureFlagsModule } from '../../src/platform/feature-flags';
import { MailerModule } from '../../src/platform/mailer';
import { OutboxRelayService } from '../../src/platform/outbox';
import { StorageModule } from '../../src/platform/storage';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { TEST_WEB_APP_URL } from './support/environment';
import { FakeMalwareScanner } from './support/fake-malware-scanner';
import { minimalPdf, png } from './support/files';
import { linkIn, Mailpit, type ReceivedEmail } from './support/mailpit';
import { uploadFile, waitUntilProcessed } from './support/media';
import { browser, createMember, grantRoleWith2fa, type Member } from './support/members';
import { createWorkerTestingModule } from './support/worker-testing-module';

const TERANGA = {
  name: 'Fondation Teranga',
  structureType: 'foundation',
  countryCodes: ['SN', 'FR'],
  sectorCodes: ['education'],
  websiteUrl: 'https://www.teranga.org',
  description: 'Bourses et mentorat pour les étudiants entrepreneurs.',
};

/** Organization pages, members, invitations and verification (ADR 0025). */
describe('organizations', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  const mailpit = new Mailpit();
  const deliver = () => worker.get(OutboxRelayService).relayBatch();

  /** Relays the outbox until the worker has sent the email. */
  async function emailTo(address: string, subject: string): Promise<ReceivedEmail> {
    await vi.waitFor(
      async () => {
        await deliver();
        const found = (await mailpit.messagesTo(address)).some((message) =>
          message.Subject.includes(subject),
        );
        if (!found) throw new Error(`No email "${subject}" to ${address} yet`);
      },
      { timeout: 20_000, interval: 200 },
    );
    return mailpit.waitFor(address, subject);
  }

  async function createOrganization(owner: Member, body: object = TERANGA) {
    const response = await owner.agent
      .post('/v1/organizations')
      .set('Idempotency-Key', `create-${Math.random()}`)
      .send(body);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body as { id: string; slug: string };
  }

  async function invite(owner: Member, organizationId: string, email: string, role = 'member') {
    await owner.agent
      .post(`/v1/organizations/${organizationId}/invitations`)
      .set('Idempotency-Key', `invite-${email}-${Math.random()}`)
      .send({ email, role })
      .expect(201);
    const received = await emailTo(email, 'Invitation à rejoindre');
    return linkIn(received, `${TEST_WEB_APP_URL}/invitations/`).split('/').pop() ?? '';
  }

  async function moderator(): Promise<Member> {
    const member = await createMember(app, 'moderator@pitchorium.test', { name: 'Modo' });
    await grantRoleWith2fa(member, 'moderator');
    return member;
  }

  const eventTypes = async (organizationId: string) =>
    (
      await query<{ event_type: string }>(
        'SELECT event_type FROM platform.outbox_events WHERE aggregate_id = $1 ORDER BY occurred_at',
        [organizationId],
      )
    ).map((event) => event.event_type);

  beforeAll(async () => {
    ({ app } = await createApiTestApp(
      [],
      { ORGANIZATIONS_VERIFICATION_CRITERIA: 'legal_registration,official_website' },
      { storage: 'minio' },
    ));
    worker = await createWorkerTestingModule(
      [],
      [
        FeatureFlagsModule,
        AuditModule,
        MailerModule,
        StorageModule,
        IdentityModule.forWorker(),
        AccessModule.forWorker(),
        MediaModule.forWorker(),
        ProfilesModule.forWorker(),
        OrganizationsModule.forWorker(),
        NetworkModule.forWorker(),
      ],
      (builder) => builder.overrideProvider(MalwareScanner).useValue(new FakeMalwareScanner()),
    );
  });

  afterAll(async () => {
    await worker.close();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    await mailpit.clear();
  });

  it('runs the membership lifecycle, from an invitation to a person without account', async () => {
    const awa = await createMember(app, 'awa@teranga.org', { name: 'Awa Ndiaye' });
    const organization = await createOrganization(awa);
    expect(organization).toMatchObject({ slug: 'fondation-teranga', viewerRole: 'owner' });

    const token = await invite(awa, organization.id, 'kofi@example.com', 'admin');
    const intruder = await createMember(app, 'intruder@example.com');
    const mismatch = await intruder.agent
      .post('/v1/organization-invitations/accept')
      .send({ token })
      .expect(403);
    expect(mismatch.body.code).toBe('ORGANIZATIONS_INVITATION_EMAIL_MISMATCH');

    // The invitee creates an account with the invited address, then accepts.
    const kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    const joined = await kofi.agent
      .post('/v1/organization-invitations/accept')
      .send({ token })
      .expect(200);
    expect(joined.body).toMatchObject({ slug: 'fondation-teranga', role: 'admin' });
    const reused = await kofi.agent
      .post('/v1/organization-invitations/accept')
      .send({ token })
      .expect(410);
    expect(reused.body.code).toBe('ORGANIZATIONS_INVITATION_INVALID');

    await awa.agent
      .patch(`/v1/organizations/${organization.id}/members/${kofi.userId}`)
      .send({ role: 'member' })
      .expect(200);
    await emailTo('kofi@example.com', 'Votre rôle dans Fondation Teranga a changé');
    // The arrival of a member is not transactional: the notifications module emails it.
    expect(
      (await mailpit.messagesTo('awa@teranga.org')).filter((m) => m.Subject.includes('a rejoint')),
    ).toEqual([]);
    await kofi.agent
      .patch(`/v1/organizations/${organization.id}`)
      .send({ description: 'Hors de ses droits' })
      .expect(403);

    const lastOwner = await awa.agent
      .delete(`/v1/organizations/${organization.id}/members/${awa.userId}`)
      .expect(409);
    expect(lastOwner.body.code).toBe('ORGANIZATIONS_LAST_OWNER');
    await awa.agent.post(`/v1/organizations/${organization.id}/leave`).expect(409);

    const transferred = await awa.agent
      .post(`/v1/organizations/${organization.id}/ownership-transfer`)
      .send({ userId: kofi.userId })
      .expect(200);
    expect(transferred.body.members).toEqual([
      expect.objectContaining({ displayName: 'Kofi Mensah', role: 'owner' }),
      expect.objectContaining({ displayName: 'Awa Ndiaye', role: 'admin' }),
    ]);
    await emailTo('kofi@example.com', 'La propriété de Fondation Teranga a été transférée');
    const adminOnOwner = await awa.agent
      .patch(`/v1/organizations/${organization.id}/members/${kofi.userId}`)
      .send({ role: 'member' })
      .expect(403);
    expect(adminOnOwner.body.code).toBe('ORGANIZATIONS_ROLE_CHANGE_FORBIDDEN');

    // A contributor links an organization they belong to, and only such one.
    await kofi.agent
      .post('/v1/me/profile/contributor-facet')
      .set('Idempotency-Key', 'facet-kofi')
      .send({ hats: ['mentor'], structureType: 'foundation', organizationId: organization.id })
      .expect(201);
    const refused = await intruder.agent
      .post('/v1/me/profile/contributor-facet')
      .set('Idempotency-Key', 'facet-intruder')
      .send({ hats: ['mentor'], structureType: 'company', organizationId: organization.id })
      .expect(422);
    expect(refused.body.code).toBe('PROFILES_ORGANIZATION_NOT_ALLOWED');
    const kofiProfile = await awa.agent.get('/v1/profiles/kofi-mensah').expect(200);
    expect(kofiProfile.body.contributorOrganization).toEqual({
      id: organization.id,
      slug: 'fondation-teranga',
      name: 'Fondation Teranga',
      verified: false,
    });

    await awa.agent.post(`/v1/organizations/${organization.id}/leave`).expect(204);
    const mine = await awa.agent.get('/v1/me/organizations').expect(200);
    expect(mine.body.items).toEqual([]);
    expect(await eventTypes(organization.id)).toEqual([
      'organizations.organization.created.v1',
      'organizations.member.invited.v1',
      'organizations.member.joined.v1',
      'organizations.member.role-changed.v1',
      'organizations.ownership.transferred.v1',
      'organizations.member.left.v1',
    ]);
  });

  it('lets the invitee decline an invitation and an admin revoke one', async () => {
    const awa = await createMember(app, 'awa@teranga.org', { name: 'Awa Ndiaye' });
    const organization = await createOrganization(awa);

    const declinedToken = await invite(awa, organization.id, 'kofi@example.com');
    const kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    await kofi.agent
      .post('/v1/organization-invitations/decline')
      .send({ token: declinedToken })
      .expect(204);
    const afterDecline = await kofi.agent
      .post('/v1/organization-invitations/accept')
      .send({ token: declinedToken })
      .expect(410);
    expect(afterDecline.body.code).toBe('ORGANIZATIONS_INVITATION_INVALID');

    const revokedToken = await invite(awa, organization.id, 'ama@example.com');
    const pending = await awa.agent
      .get(`/v1/organizations/${organization.id}/invitations`)
      .expect(200);
    expect(pending.body.items).toEqual([
      expect.objectContaining({ email: 'ama@example.com', status: 'pending' }),
    ]);
    const invitationId = (pending.body.items as { id: string }[])[0]?.id ?? '';
    await awa.agent
      .delete(`/v1/organizations/${organization.id}/invitations/${invitationId}`)
      .expect(204);
    await awa.agent
      .delete(`/v1/organizations/${organization.id}/invitations/${invitationId}`)
      .expect(410);
    const ama = await createMember(app, 'ama@example.com', { name: 'Ama Owusu' });
    const afterRevocation = await ama.agent
      .post('/v1/organization-invitations/accept')
      .send({ token: revokedToken })
      .expect(410);
    expect(afterRevocation.body.code).toBe('ORGANIZATIONS_INVITATION_INVALID');

    const invitations = await query<{ email: string; status: string; responded_by: string | null }>(
      `SELECT email, status, responded_by FROM organizations.invitations
       WHERE organization_id = $1 ORDER BY created_at`,
      [organization.id],
    );
    expect(invitations).toEqual([
      { email: 'kofi@example.com', status: 'declined', responded_by: kofi.userId },
      { email: 'ama@example.com', status: 'revoked', responded_by: null },
    ]);
    const page = await awa.agent.get('/v1/organizations/by-slug/fondation-teranga').expect(200);
    expect(page.body.members).toEqual([expect.objectContaining({ displayName: 'Awa Ndiaye' })]);
    expect(await eventTypes(organization.id)).not.toContain('organizations.member.joined.v1');
  });

  it('rejects a verification request with a reason, then accepts a new request', async () => {
    const awa = await createMember(app, 'awa@teranga.org', { name: 'Awa Ndiaye' });
    const organization = await createOrganization(awa);
    const upload = async () => {
      const id = await uploadFile(
        awa.agent,
        minimalPdf(),
        'verification_document',
        'application/pdf',
      );
      await waitUntilProcessed(awa.agent, id, deliver);
      return id;
    };
    const request = async (key: string, document: string) =>
      (
        await awa.agent
          .post(`/v1/organizations/${organization.id}/verification-requests`)
          .set('Idempotency-Key', key)
          .send({
            declaration: 'Association déclarée, récépissé joint.',
            certified: true,
            documentMediaIds: [document],
          })
          .expect((response) => {
            expect(response.status, JSON.stringify(response.body)).toBe(201);
          })
      ).body as { id: string };
    const firstDocument = await upload();
    const first = await request('verification-rejected-1', firstDocument);

    const reviewer = await moderator();
    const decided = await reviewer.agent
      .post(`/v1/admin/organizations/verification-requests/${first.id}/decision`)
      .send({ decision: 'rejected', reason: 'Récépissé illisible.', criteriaMet: [] })
      .expect(200);
    expect(decided.body).toMatchObject({
      status: 'rejected',
      decisionReason: 'Récépissé illisible.',
      decidedBy: reviewer.userId,
      organization: { verificationStatus: 'rejected' },
    });
    const page = await browser(app).get('/v1/public/organizations/fondation-teranga').expect(200);
    expect(page.body.verification).toMatchObject({ status: 'rejected', verified: false });
    const rejected = await emailTo('awa@teranga.org', 'Vérification de Fondation Teranga refusée');
    expect(rejected.text).toContain('Récépissé illisible.');
    const again = await reviewer.agent
      .post(`/v1/admin/organizations/verification-requests/${first.id}/decision`)
      .send({ decision: 'approved', reason: 'Trop tard.', criteriaMet: [] })
      .expect(409);
    expect(again.body.code).toBe('ORGANIZATIONS_VERIFICATION_INVALID_STATE');

    // A rejection lets the owner file a new request, with new documents: those of a decided
    // request stay attached to it, as the record of the decision.
    const reused = await awa.agent
      .post(`/v1/organizations/${organization.id}/verification-requests`)
      .set('Idempotency-Key', 'verification-rejected-reused')
      .send({
        declaration: 'Association déclarée, récépissé joint.',
        certified: true,
        documentMediaIds: [firstDocument],
      })
      .expect(409);
    expect(reused.body.code).toBe('MEDIA_ATTACHED');
    const second = await request('verification-rejected-2', await upload());
    expect(second.id).not.toBe(first.id);
    expect(await eventTypes(organization.id)).toEqual([
      'organizations.organization.created.v1',
      'organizations.verification.requested.v1',
      'organizations.verification.rejected.v1',
      'organizations.verification.requested.v1',
    ]);
  });

  it('verifies an organization with a private document and a moderator decision', async () => {
    const awa = await createMember(app, 'awa@teranga.org', { name: 'Awa Ndiaye' });
    const organization = await createOrganization(awa);
    const document = await uploadFile(
      awa.agent,
      minimalPdf(),
      'verification_document',
      'application/pdf',
    );
    await waitUntilProcessed(awa.agent, document, deliver);

    const requested = await awa.agent
      .post(`/v1/organizations/${organization.id}/verification-requests`)
      .set('Idempotency-Key', 'verification-1')
      .send({
        declaration: 'Fondation reconnue d’utilité publique, statuts et récépissé joints.',
        certified: true,
        documentMediaIds: [document],
      })
      .expect(201);
    expect(requested.body).toMatchObject({
      status: 'pending',
      signals: { websiteDomain: 'teranga.org', memberEmailOnWebsiteDomain: true },
      organization: { verificationStatus: 'pending' },
    });
    await emailTo('awa@teranga.org', 'Demande de vérification reçue');
    const twice = await awa.agent
      .post(`/v1/organizations/${organization.id}/verification-requests`)
      .set('Idempotency-Key', 'verification-2')
      .send({
        declaration: 'Une seconde demande en parallèle.',
        certified: true,
        documentMediaIds: [document],
      })
      .expect(409);
    expect(twice.body.code).toBe('ORGANIZATIONS_VERIFICATION_INVALID_STATE');

    const stranger = await createMember(app, 'stranger@example.com');
    await stranger.agent.get(`/v1/media/${document}/download-url`).expect(404);
    await stranger.agent.get('/v1/admin/organizations/verification-requests').expect(403);

    const reviewer = await moderator();
    const queue = await reviewer.agent
      .get('/v1/admin/organizations/verification-requests')
      .expect(200);
    expect(queue.body.criteria).toEqual(['legal_registration', 'official_website']);
    expect(queue.body.items).toEqual([expect.objectContaining({ id: requested.body.id })]);
    const read = await reviewer.agent.get(`/v1/media/${document}/download-url`).expect(200);
    expect((await fetch(read.body.url as string)).status).toBe(200);

    const unknownCriterion = await reviewer.agent
      .post(`/v1/admin/organizations/verification-requests/${requested.body.id}/decision`)
      .send({ decision: 'approved', reason: 'Statuts conformes.', criteriaMet: ['made_up'] })
      .expect(422);
    expect(unknownCriterion.body.code).toBe('ORGANIZATIONS_VERIFICATION_CRITERION_UNKNOWN');
    const decided = await reviewer.agent
      .post(`/v1/admin/organizations/verification-requests/${requested.body.id}/decision`)
      .send({
        decision: 'approved',
        reason: 'Statuts et récépissé conformes au site officiel.',
        criteriaMet: ['legal_registration', 'official_website'],
      })
      .expect(200);
    expect(decided.body).toMatchObject({ status: 'approved', decidedBy: reviewer.userId });
    const page = await browser(app).get('/v1/public/organizations/fondation-teranga').expect(200);
    expect(page.body.verification).toMatchObject({ status: 'verified', verified: true });
    const approved = await emailTo('awa@teranga.org', 'Fondation Teranga est vérifiée');
    expect(approved.text).toContain('Statuts et récépissé conformes au site officiel.');

    await reviewer.agent
      .post(`/v1/admin/organizations/${organization.id}/verification-revocation`)
      .send({ reason: 'Agrément retiré par l’autorité de tutelle.' })
      .expect(204);
    const revoked = await emailTo('awa@teranga.org', 'Vérification de Fondation Teranga retirée');
    expect(revoked.text).toContain('Agrément retiré');
    const audit = await query<{ action: string; actor_id: string }>(
      `SELECT action, actor_id FROM platform.audit_log
       WHERE target_id = $1 AND action LIKE 'organizations.%' ORDER BY occurred_at`,
      [organization.id],
    );
    expect(audit).toEqual([
      { action: 'organizations.verification-requested', actor_id: awa.userId },
      { action: 'organizations.verification-approved', actor_id: reviewer.userId },
      { action: 'organizations.verification-revoked', actor_id: reviewer.userId },
    ]);
  });

  it('shows publicly only the members with a public profile page', async () => {
    const awa = await createMember(app, 'awa@teranga.org', { name: 'Awa Ndiaye' });
    await awa.agent
      .patch('/v1/me/profile/visibility')
      .send({ publicPageEnabled: true })
      .expect(200);
    const organization = await createOrganization(awa);
    const token = await invite(awa, organization.id, 'discreet@example.com');
    const discreet = await createMember(app, 'discreet@example.com', { name: 'Discret Membre' });
    await discreet.agent.post('/v1/organization-invitations/accept').send({ token }).expect(200);

    const logo = await uploadFile(awa.agent, await png(400, 400), 'organization_logo', 'image/png');
    await waitUntilProcessed(awa.agent, logo, deliver);
    await awa.agent
      .put(`/v1/organizations/${organization.id}/logo`)
      .send({ mediaId: logo })
      .expect(200);

    const visitor = await browser(app)
      .get('/v1/public/organizations/fondation-teranga')
      .expect(200);
    expect(visitor.headers['cache-control']).toBe('public, max-age=60');
    expect(visitor.body).toMatchObject({
      viewerRole: null,
      projects: { carried: [], supported: [] },
    });
    const handles = (body: unknown) =>
      (body as { members: { handle: string }[] }).members.map((member) => member.handle);
    expect(handles(visitor.body)).toEqual(['awa-ndiaye']);
    expect((await fetch(visitor.body.logoUrl as string)).status).toBe(200);

    const reader = await createMember(app, 'reader@example.com');
    const forMembers = await reader.agent
      .get('/v1/organizations/by-slug/fondation-teranga')
      .expect(200);
    expect(handles(forMembers.body)).toEqual(['awa-ndiaye', 'discret-membre']);
  });

  it('redirects from a former slug and never gives it to another organization', async () => {
    const awa = await createMember(app, 'awa@teranga.org', { name: 'Awa Ndiaye' });
    const organization = await createOrganization(awa);
    await awa.agent
      .put(`/v1/organizations/${organization.id}/slug`)
      .send({ slug: 'teranga' })
      .expect(200);

    const moved = await browser(app).get('/v1/public/organizations/fondation-teranga').expect(301);
    expect(moved.headers['location']).toBe('/v1/public/organizations/teranga');
    const forMember = await awa.agent
      .get('/v1/organizations/by-slug/fondation-teranga')
      .expect(301);
    expect(forMember.headers['location']).toBe('/v1/organizations/by-slug/teranga');

    const other = await createOrganization(awa, { ...TERANGA, name: 'Autre Fondation' });
    const taken = await awa.agent
      .put(`/v1/organizations/${other.id}/slug`)
      .send({ slug: 'fondation-teranga' })
      .expect(409);
    expect(taken.body.code).toBe('ORGANIZATIONS_SLUG_TAKEN');
    const homonym = await createOrganization(awa);
    expect(homonym.slug).toBe('fondation-teranga-2');

    await awa.agent.delete(`/v1/organizations/${organization.id}`).expect(204);
    await browser(app).get('/v1/public/organizations/teranga').expect(404);
    await browser(app).get('/v1/public/organizations/fondation-teranga').expect(404);
  });
});
