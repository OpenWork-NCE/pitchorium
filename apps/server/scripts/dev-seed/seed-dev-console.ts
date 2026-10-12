import type { INestApplicationContext } from '@nestjs/common';
import type { ImpactMethodologyDraft } from '@pitchorium/contracts';
import type { Database } from '@pitchorium/db';
import { eq } from '@pitchorium/db/orm';
import { identityTwoFactors, identityUsers } from '@pitchorium/db/schemas/identity';
import { symmetricEncrypt } from 'better-auth/crypto';
import { Queue } from 'bullmq';
import { RoleRepository } from '../../src/modules/access/application/ports';
import { MethodologiesService } from '../../src/modules/impact/application/methodologies.service';
import { PaymentsRepository } from '../../src/modules/payments/application/ports';
import { TRUST_JOBS, TRUST_QUEUE } from '../../src/modules/trust/interface/trust-queue';
import type { FixedClock } from '../../src/platform/kernel/clock';
import { DEMO_METHODOLOGY } from './projects-dataset';
import { demoId } from './seed-dev-data';

const DAY_MS = 86_400_000;

/**
 * Raw secret of the second factor of the demonstration staff (development data only, refused
 * in production with the rest of the seed). Authenticator apps read it in base32:
 * DEMO_STAFF_TOTP_BASE32, documented in docs/frontend-handoff.md.
 */
export const DEMO_STAFF_TOTP_SECRET = 'pitchorium-demo-staff-totp-2026';

/** The administrator and the moderator of the review of the console (with their second factor). */
export const DEMO_ADMIN = 'claudine';
export const DEMO_MODERATOR = 'koffi';

/** RFC 4648 base32 without padding, as the TOTP address of Better Auth carries the secret. */
export function base32(text: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of Buffer.from(text, 'utf8')) bits += byte.toString(2).padStart(8, '0');
  let encoded = '';
  for (let index = 0; index < bits.length; index += 5) {
    encoded += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return encoded;
}

export const DEMO_STAFF_TOTP_BASE32 = base32(DEMO_STAFF_TOTP_SECRET);

export interface DevConsoleResult {
  staffSecondFactors: number;
  administrators: number;
  failedJobs: number;
  discrepancies: number;
  draftMethodologies: number;
}

/**
 * A second version of the DEMO methodology in draft, with a criterion written in French only:
 * the console shows what an active language still lacks before the publication (ADR 0173).
 */
const DEMO_DRAFT: ImpactMethodologyDraft = {
  name: 'DEMO v2, brouillon non contractuel',
  criteria: [
    ...DEMO_METHODOLOGY.criteria,
    {
      key: 'demo_criterion_5',
      labelKey: 'impactDemo.criterion05.label',
      descriptionKey: 'impactDemo.criterion05.description',
      labels: { fr: 'Critère de démonstration 5' },
      descriptions: { fr: 'Critère de démonstration, non contractuel.' },
      weight: 1,
      scale: DEMO_METHODOLOGY.criteria[0]!.scale,
    },
  ],
};

/**
 * What the console of the administration needs to be reviewed (PROMPT FRONT 9A): the
 * demonstration administrator (Claudine Pierre-Louis) and moderator (Koffi Agbodjan) with their
 * second factor on, a job failed for good once the worker ran it (a refund of a contribution
 * that does not exist), an open discrepancy of the reconciliation and a draft methodology. The
 * other queues are filled by the earlier steps. Idempotent.
 */
export async function seedDevConsole(
  db: Database,
  context: INestApplicationContext,
  clock: FixedClock,
  options: { authSecret: string; redisUrl: string; queuePrefix: string; now: Date },
): Promise<DevConsoleResult> {
  const get = <T>(type: abstract new (...args: never[]) => T): T =>
    context.get<T>(type, { strict: false });
  const userId = (key: string) => demoId(`member:${key}`);
  const result: DevConsoleResult = {
    staffSecondFactors: 0,
    administrators: 0,
    failedJobs: 0,
    discrepancies: 0,
    draftMethodologies: 0,
  };

  if (
    await get(RoleRepository).grant(userId(DEMO_ADMIN), {
      role: 'admin',
      grantedAt: options.now,
      grantedBy: null,
    })
  ) {
    result.administrators += 1;
  }

  for (const key of [DEMO_ADMIN, DEMO_MODERATOR]) {
    const id = userId(key);
    const existing = await db
      .select({ id: identityTwoFactors.id })
      .from(identityTwoFactors)
      .where(eq(identityTwoFactors.userId, id));
    if (existing.length > 0) continue;
    await db.transaction(async (tx) => {
      await tx.insert(identityTwoFactors).values({
        id: demoId(`two-factor:${key}`),
        userId: id,
        secret: await symmetricEncrypt({ key: options.authSecret, data: DEMO_STAFF_TOTP_SECRET }),
        backupCodes: await symmetricEncrypt({ key: options.authSecret, data: '[]' }),
        verified: true,
      });
      await tx
        .update(identityUsers)
        .set({ twoFactorEnabled: true })
        .where(eq(identityUsers.id, id));
    });
    result.staffSecondFactors += 1;
  }

  // A refund the worker cannot make: the contribution does not exist. Its single attempt fails,
  // and the job waits in the failed jobs of the console.
  const queue = new Queue(TRUST_QUEUE, {
    connection: { url: options.redisUrl, maxRetriesPerRequest: null },
    prefix: options.queuePrefix,
  });
  try {
    const jobId = 'demo-refund-of-a-missing-contribution';
    if (!(await queue.getJob(jobId))) {
      await queue.add(
        TRUST_JOBS.refund,
        { contributionId: demoId('contribution:missing'), reason: 'Données de démonstration.' },
        { jobId, attempts: 1, removeOnFail: false },
      );
      result.failedJobs += 1;
    }
  } finally {
    await queue.close();
  }

  if (
    await get(PaymentsRepository).insertDiscrepancy({
      id: demoId('discrepancy:amount'),
      runId: null,
      kind: 'amount_mismatch',
      provider: 'simulated',
      reference: 'sim_pi_demo_amount_mismatch',
      contributionId: null,
      projectId: null,
      expected: '5000 EUR',
      actual: '4500 EUR',
      status: 'open',
      detectedAt: new Date(options.now.getTime() - DAY_MS),
      resolvedAt: null,
      resolvedBy: null,
      resolution: null,
    })
  ) {
    result.discrepancies += 1;
  }

  const methodologies = get(MethodologiesService);
  if (!(await methodologies.list()).some((methodology) => methodology.status === 'draft')) {
    clock.set(new Date(options.now.getTime() - 2 * DAY_MS));
    await methodologies.createDraft(userId(DEMO_ADMIN), DEMO_DRAFT);
    clock.set(options.now);
    result.draftMethodologies += 1;
  }
  return result;
}
