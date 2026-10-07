import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Contribution, Project } from '@pitchorium/contracts';
import request from 'supertest';
import { v7 } from 'uuid';
import { expect } from 'vitest';
import { query } from './database';
import { ENTREPRENEUR_FACET } from './impact';
import { createMember, type Member } from './members';

export const eur = (amount: number) => ({ amountMinor: String(amount * 100), currency: 'EUR' });

/** A ready private PDF of usage `verification_document`, as the media worker would leave it. */
export async function readyDocument(ownerId: string): Promise<string> {
  const mediaId = v7();
  await query(
    `INSERT INTO media.assets (id, owner_id, usage, source, status, visibility,
       declared_content_type, declared_size, content_type, size, page_count, quarantine_key,
       moderation_status, files, unattached_since, created_at, updated_at, processed_at)
     VALUES ($1, $2, 'verification_document', 'upload', 'ready', 'private', 'application/pdf',
       100, 'application/pdf', 100, 1, $3, 'none', $4::jsonb, now(), now(), now(), now())`,
    [
      mediaId,
      ownerId,
      `quarantine/${mediaId}`,
      JSON.stringify({ fileKey: `media/${mediaId}/document.pdf`, variants: {} }),
    ],
  );
  return mediaId;
}

/** Posts a provider notification with its exact body and headers, as the provider would. */
export function postWebhook(
  app: NestExpressApplication,
  provider: string,
  webhook: { headers: Record<string, string>; body: string },
): request.Test {
  let test = request(app.getHttpServer()).post(`/v1/payments/webhooks/${provider}`);
  for (const [name, value] of Object.entries(webhook.headers)) test = test.set(name, value);
  return test.send(webhook.body);
}

export async function entrepreneur(
  app: NestExpressApplication,
  email: string,
  name: string,
): Promise<Member> {
  const member = await createMember(app, email, { name });
  await member.agent.get('/v1/me/profile').expect(200);
  await member.agent
    .post('/v1/me/profile/entrepreneur-facet')
    .set('Idempotency-Key', `facet-${email}`)
    .send(ENTREPRENEUR_FACET)
    .expect(201);
  return member;
}

export const TIERS = [
  { threshold: eur(2_000), description: 'Étude du site' },
  { threshold: eur(6_000), description: 'Achat des pompes' },
  { threshold: eur(10_000), description: 'Installation et formation' },
];

/** A published project accepting donations, rewards crowdfunding and love money. */
export async function publishedProject(
  owner: Member,
  title = 'Sahel Agri : irrigation',
): Promise<Project> {
  const created = await owner.agent
    .post('/v1/projects')
    .set('Idempotency-Key', randomUUID())
    .send({
      title,
      summary: 'Des pompes solaires pour 40 exploitations du delta.',
      description: 'Une coopérative de 40 exploitations.',
      sectorCode: 'agriculture_forestry_fishing',
      impactArea: 'Delta du fleuve Sénégal',
      countryCodes: ['SN'],
      instruments: ['donation', 'reward_crowdfunding', 'love_money', 'equity'],
      goal: eur(10_000),
      durationDays: 45,
    });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const project = created.body as Project;
  await owner.agent.put(`/v1/projects/${project.id}/tiers`).send({ tiers: TIERS }).expect(200);
  const published = await owner.agent
    .post(`/v1/projects/${project.id}/publish`)
    .send({ publicDisplayConsent: true });
  expect(published.status, JSON.stringify(published.body)).toBe(200);
  return published.body as Project;
}

export async function addReward(
  owner: Member,
  projectId: string,
  minEuros: number,
  quantity: number | null,
): Promise<string> {
  const response = await owner.agent
    .post(`/v1/projects/${projectId}/rewards`)
    .set('Idempotency-Key', randomUUID())
    .send({
      title: `Contrepartie ${minEuros} €`,
      description: 'Visite de la coopérative.',
      minAmount: eur(minEuros),
      instruments: ['reward_crowdfunding'],
      quantity,
    });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.id as string;
}

export async function contribute(
  member: Member,
  projectId: string,
  body: Record<string, unknown>,
  expected = 201,
): Promise<Contribution> {
  const response = await member.agent
    .post(`/v1/projects/${projectId}/contributions`)
    .set('Idempotency-Key', randomUUID())
    .send({ method: 'card', ...body });
  expect(response.status, JSON.stringify(response.body)).toBe(expected);
  return response.body as Contribution;
}

/** Collected amount of a project, in cents. */
export async function collected(projectId: string): Promise<bigint> {
  const [row] = await query<{ collected_minor: string }>(
    'SELECT collected_minor::text FROM projects.projects WHERE id = $1',
    [projectId],
  );
  return BigInt(row?.collected_minor ?? '0');
}

/** Sum of the ledger lines per currency: every one is zero when the ledger balances. */
export async function ledgerBalances(): Promise<Record<string, string>> {
  const rows = await query<{ currency: string; sum: string }>(
    'SELECT currency, sum(amount_minor)::text AS sum FROM payments.ledger_lines GROUP BY currency',
  );
  return Object.fromEntries(rows.map((row) => [row.currency, row.sum]));
}
