import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { truncateAllTables } from './support/database';
import { createMember, type Member } from './support/members';

const ENTREPRENEUR = {
  companyName: 'Sahel Agri',
  sectorCode: 'agriculture_forestry_fishing',
  stageCode: 'prototype',
  companyCountryCode: 'SN',
  fundingTarget: { amountMinor: '5000000', currency: 'XOF' },
};

const CONTRIBUTOR = {
  hats: ['mentor', 'investor'],
  structureType: 'individual',
  ticket: { minAmountMinor: '100000', maxAmountMinor: '2500000', currency: 'EUR' },
};

describe('profiles', () => {
  let app: NestExpressApplication;
  let owner: Member;
  let reader: Member;
  const anonymous = () => request(app.getHttpServer());
  let keys = 0;
  const key = () => `key-${(keys += 1)}`;

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    owner = await createMember(app, 'owner@example.com', { name: 'Aïssatou Ba' });
    reader = await createMember(app, 'reader@example.com', { name: 'Reader' });
  });

  async function withBothFacets(): Promise<void> {
    await owner.agent
      .post('/v1/me/profile/entrepreneur-facet')
      .set('Idempotency-Key', key())
      .send(ENTREPRENEUR)
      .expect(201);
    await owner.agent
      .post('/v1/me/profile/contributor-facet')
      .set('Idempotency-Key', key())
      .send(CONTRIBUTOR)
      .expect(201);
  }

  const setVisibility = (visibility: object) =>
    owner.agent.patch('/v1/me/profile/visibility').send(visibility).expect(200);

  describe('privacy', () => {
    it('keeps the public page off by default and applies each visibility setting', async () => {
      await withBothFacets();
      const own = await owner.agent.get('/v1/me/profile').expect(200);
      expect(own.body.visibility).toEqual({
        publicPageEnabled: false,
        entrepreneurDetails: 'members',
        contributorDetails: 'members',
        networkLists: 'members',
      });
      const handle = own.body.handle as string;
      expect(handle).toBe('aissatou-ba');

      await anonymous().get(`/v1/public/profiles/${handle}`).expect(404);
      const asMember = await reader.agent.get(`/v1/profiles/${handle}`).expect(200);
      expect(asMember.body).toMatchObject({
        displayName: 'Aïssatou Ba',
        facets: { entrepreneur: true, contributor: true },
        entrepreneur: { companyName: 'Sahel Agri' },
        contributor: { hats: ['mentor', 'investor'] },
      });

      expect((await anonymous().get('/v1/public/profiles').expect(200)).body.items).toEqual([]);
      await setVisibility({ publicPageEnabled: true, entrepreneurDetails: 'public' });
      // A public page is listed for the sitemap, by handle.
      const listed = await anonymous().get('/v1/public/profiles').expect(200);
      expect(listed.headers['cache-control']).toBe('public, max-age=300');
      expect(listed.body).toEqual({
        items: [{ handle, updatedAt: expect.any(String) }],
        nextCursor: null,
      });
      const asPublic = await anonymous().get(`/v1/public/profiles/${handle}`).expect(200);
      expect(asPublic.headers['cache-control']).toBe('public, max-age=60');
      expect(asPublic.body).toMatchObject({
        handle,
        facets: { entrepreneur: true, contributor: true },
        entrepreneur: { companyName: 'Sahel Agri' },
        contributor: null,
      });
      expect(asPublic.body).not.toHaveProperty('visibility');
      expect(asPublic.body).not.toHaveProperty('intention');
      expect(asPublic.body).not.toHaveProperty('userId');

      await setVisibility({ entrepreneurDetails: 'private', contributorDetails: 'private' });
      const hidden = await reader.agent.get(`/v1/profiles/${handle}`).expect(200);
      expect(hidden.body).toMatchObject({ entrepreneur: null, contributor: null });
      const publicHidden = await anonymous().get(`/v1/public/profiles/${handle}`).expect(200);
      expect(publicHidden.body).toMatchObject({ entrepreneur: null, contributor: null });
      const ownView = await owner.agent.get('/v1/me/profile').expect(200);
      expect(ownView.body.entrepreneur).toMatchObject({ companyName: 'Sahel Agri' });

      await setVisibility({ contributorDetails: 'public', publicPageEnabled: false });
      await anonymous().get(`/v1/public/profiles/${handle}`).expect(404);
      expect((await anonymous().get('/v1/public/profiles').expect(200)).body.items).toEqual([]);
    });

    it('requires an account and accepted terms for the member view', async () => {
      await anonymous().get('/v1/profiles/aissatou-ba').expect(401);
      const newcomer = await createMember(app, 'newcomer@example.com', { legal: false });
      const refused = await newcomer.agent.get('/v1/profiles/aissatou-ba').expect(403);
      expect(refused.body.missing).toEqual(['legal_acceptance']);
    });
  });

  describe('handle', () => {
    it('redirects from a former handle and never gives it to someone else', async () => {
      await setVisibility({ publicPageEnabled: true });
      await owner.agent.put('/v1/me/profile/handle').send({ handle: 'aissatou' }).expect(200);

      const moved = await anonymous().get('/v1/public/profiles/aissatou-ba').expect(301);
      expect(moved.headers['location']).toBe('/v1/public/profiles/aissatou');
      const movedForMember = await reader.agent.get('/v1/profiles/aissatou-ba').expect(301);
      expect(movedForMember.headers['location']).toBe('/v1/profiles/aissatou');
      await anonymous().get('/v1/public/profiles/aissatou').expect(200);

      const taken = await reader.agent
        .put('/v1/me/profile/handle')
        .send({ handle: 'aissatou-ba' })
        .expect(409);
      expect(taken.body.code).toBe('PROFILES_HANDLE_TAKEN');
      const reserved = await reader.agent
        .put('/v1/me/profile/handle')
        .send({ handle: 'settings' })
        .expect(409);
      expect(reserved.body.code).toBe('PROFILES_HANDLE_RESERVED');

      // The owner may take a former handle back.
      await owner.agent.put('/v1/me/profile/handle').send({ handle: 'aissatou-ba' }).expect(200);
      await anonymous().get('/v1/public/profiles/aissatou-ba').expect(200);
      await anonymous().get('/v1/public/profiles/aissatou').expect(301);

      // Without a public page, a former handle leaks nothing either.
      await setVisibility({ publicPageEnabled: false });
      await anonymous().get('/v1/public/profiles/aissatou').expect(404);
    });

    it('generates distinct handles for homonyms', async () => {
      await owner.agent.get('/v1/me/profile').expect(200);
      const homonym = await createMember(app, 'homonym@example.com', { name: 'Aïssatou Ba' });
      const profile = await homonym.agent.get('/v1/me/profile').expect(200);
      expect(profile.body.handle).toBe('aissatou-ba-2');
    });
  });

  describe('facets', () => {
    it('lets both facets coexist and enforces their rules', async () => {
      await owner.agent.patch('/v1/me/profile').send({ countryCode: 'FR' }).expect(200);
      const notEligible = await owner.agent
        .post('/v1/me/profile/entrepreneur-facet')
        .set('Idempotency-Key', key())
        .send({ ...ENTREPRENEUR, companyCountryCode: 'FR' })
        .expect(422);
      expect(notEligible.body.code).toBe('PROFILES_COMPANY_COUNTRY_NOT_ELIGIBLE');
      const unknownSector = await owner.agent
        .post('/v1/me/profile/entrepreneur-facet')
        .set('Idempotency-Key', key())
        .send({ ...ENTREPRENEUR, sectorCode: 'space_mining' })
        .expect(422);
      expect(unknownSector.body.code).toBe('PROFILES_UNKNOWN_REFERENCE');

      // A company in the Caribbean, a founder living in France.
      const created = await owner.agent
        .post('/v1/me/profile/entrepreneur-facet')
        .set('Idempotency-Key', key())
        .send({ ...ENTREPRENEUR, companyCountryCode: 'HT' })
        .expect(201);
      expect(created.body).toMatchObject({
        countryCode: 'FR',
        entrepreneur: { companyCountryCode: 'HT' },
      });
      const duplicate = await owner.agent
        .post('/v1/me/profile/entrepreneur-facet')
        .set('Idempotency-Key', key())
        .send(ENTREPRENEUR)
        .expect(409);
      expect(duplicate.body.code).toBe('PROFILES_FACET_ALREADY_EXISTS');

      const noHat = await owner.agent
        .post('/v1/me/profile/contributor-facet')
        .set('Idempotency-Key', key())
        .send({ ...CONTRIBUTOR, hats: [] })
        .expect(422);
      expect(noHat.body.code).toBe('PROFILES_CONTRIBUTOR_HAT_REQUIRED');
      const badTicket = await owner.agent
        .post('/v1/me/profile/contributor-facet')
        .set('Idempotency-Key', key())
        .send({
          ...CONTRIBUTOR,
          ticket: { minAmountMinor: '900', maxAmountMinor: '100', currency: 'EUR' },
        })
        .expect(422);
      expect(badTicket.body.code).toBe('PROFILES_TICKET_RANGE_INVALID');

      const both = await owner.agent
        .post('/v1/me/profile/contributor-facet')
        .set('Idempotency-Key', key())
        .send(CONTRIBUTOR)
        .expect(201);
      expect(both.body.facets).toEqual({ entrepreneur: true, contributor: true });

      const updated = await owner.agent
        .patch('/v1/me/profile/contributor-facet')
        .send({ hats: ['expert'], mentoringAvailable: true })
        .expect(200);
      expect(updated.body.contributor).toMatchObject({
        hats: ['expert'],
        mentoringAvailable: true,
        ticket: CONTRIBUTOR.ticket,
      });

      await owner.agent.delete('/v1/me/profile/entrepreneur-facet').expect(200);
      const gone = await owner.agent.delete('/v1/me/profile/entrepreneur-facet').expect(404);
      expect(gone.body.code).toBe('PROFILES_FACET_NOT_FOUND');
    });

    it('validates the base profile fields', async () => {
      const response = await owner.agent
        .patch('/v1/me/profile')
        .send({
          headline: 'x'.repeat(221),
          languages: ['fr', 'xx'],
          links: { website: 'http://insecure.example', linkedin: null },
        })
        .expect(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pointer: '/headline' }),
          expect.objectContaining({ pointer: '/languages/1' }),
          expect.objectContaining({ pointer: '/links/website' }),
        ]),
      );
    });
  });

  describe('current user and onboarding', () => {
    it('reports intention and profile strength, and lets the intention be cleared', async () => {
      const set = await owner.agent
        .put('/v1/me/intention')
        .send({ intention: 'carry_project' })
        .expect(200);
      expect(set.body.intention).toBe('carry_project');
      const me = await owner.agent.get('/v1/me').expect(200);
      expect(me.body.profile.intention).toBe('carry_project');
      expect(me.body.profileStrength).toMatchObject({ level: 'beginner', percent: 15 });
      expect(me.body.activeLocales).toEqual(['fr', 'en']);

      await owner.agent.put('/v1/me/intention').send({ intention: null }).expect(200);
      await owner.agent.put('/v1/me/preferences').send({ locale: 'en' }).expect(200);
      const inactive = await owner.agent
        .put('/v1/me/preferences')
        .send({ locale: 'wo' })
        .expect(422);
      expect(inactive.body.code).toBe('IDENTITY_LOCALE_NOT_ACTIVE');
    });
  });

  describe('reference data', () => {
    it('is public, cacheable and marks the eligible company countries', async () => {
      const response = await anonymous().get('/v1/reference-data').expect(200);
      expect(response.headers['cache-control']).toBe('public, max-age=3600');
      const countries = response.body.countries as { code: string; eligibleForCompany: boolean }[];
      expect(countries).toHaveLength(249);
      const eligible = new Set(countries.filter((c) => c.eligibleForCompany).map((c) => c.code));
      expect(eligible.size).toBe(60 + 28);
      expect(['SN', 'CI', 'CD', 'HT', 'JM', 'MQ'].every((code) => eligible.has(code))).toBe(true);
      expect(['FR', 'BR', 'US'].some((code) => eligible.has(code))).toBe(false);
      expect(response.body.sectors).toHaveLength(21);
      const stages = response.body.stages as { code: string }[];
      expect(stages.map((stage) => stage.code)).toEqual([
        'idea',
        'prototype',
        'early_revenue',
        'growth',
        'scale',
      ]);
      expect(response.body.entrepreneurNeeds).toContainEqual({
        code: 'mentoring',
        labelKey: 'entrepreneurNeeds.mentoring',
        matchingHats: ['mentor'],
      });
    });
  });
});
