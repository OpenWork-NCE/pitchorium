import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it } from 'vitest';
import type { TransactionManager } from '../../../platform/database';
import { DomainError, FixedClock, UuidV7Generator } from '../../../platform/kernel';
import type { ProjectRecord } from '../domain/project';
import type { ReservationRecord, RewardRecord } from '../domain/rewards';
import type { ProjectEventsRecorder } from './project-events.recorder';
import type { ProjectRepository } from './ports';
import { RewardsService } from './rewards.service';

/**
 * In-memory rows with the row lock of `lockReward` (SELECT ... FOR UPDATE): held until the end
 * of the transaction, as PostgreSQL does. Every awaited call yields to the other contributions.
 */
class InMemoryRewards {
  readonly rewards = new Map<string, RewardRecord>();
  readonly reservations = new Map<string, ReservationRecord>();
  readonly events: string[] = [];
  private readonly locks = new Map<string, Promise<void>>();
  private readonly held = new AsyncLocalStorage<(() => void)[]>();

  readonly transactions = {
    run: async <T>(work: () => Promise<T>): Promise<T> => {
      const releases: (() => void)[] = [];
      try {
        return await this.held.run(releases, work);
      } finally {
        for (const release of releases) release();
      }
    },
  } as unknown as TransactionManager;

  readonly recorder = {
    record: (event: { TYPE: string }) => {
      this.events.push(event.TYPE);
      return Promise.resolve();
    },
  } as unknown as ProjectEventsRecorder;

  readonly repository = {
    lockReward: async (id: string) => {
      const previous = this.locks.get(id) ?? Promise.resolve();
      let release = () => {};
      const next = new Promise<void>((resolve) => (release = resolve));
      this.locks.set(
        id,
        previous.then(() => next),
      );
      await previous;
      this.held.getStore()?.push(release);
      return this.copy(id);
    },
    findProject: () => Promise.resolve({ status: 'funding', deletedAt: null } as ProjectRecord),
    findReservation: async (contributionId: string) => {
      await Promise.resolve();
      return this.reservations.get(contributionId) ?? null;
    },
    insertReservation: async (reservation: ReservationRecord) => {
      await Promise.resolve();
      if (this.reservations.has(reservation.contributionId)) throw new Error('Duplicate key');
      this.reservations.set(reservation.contributionId, reservation);
    },
    setReservationStatus: async (contributionId: string, status: ReservationRecord['status']) => {
      await Promise.resolve();
      const reservation = this.reservations.get(contributionId);
      if (reservation) this.reservations.set(contributionId, { ...reservation, status });
    },
    updateReward: async (id: string, patch: Partial<RewardRecord>) => {
      await Promise.resolve();
      const reward = this.rewards.get(id);
      if (reward) this.rewards.set(id, { ...reward, ...patch });
    },
  } as unknown as ProjectRepository;

  private async copy(id: string): Promise<RewardRecord | null> {
    await Promise.resolve();
    const reward = this.rewards.get(id);
    return reward ? { ...reward } : null;
  }
}

function setup(quantity: number | null) {
  const memory = new InMemoryRewards();
  memory.rewards.set('r-1', {
    id: 'r-1',
    projectId: 'p-1',
    title: 'Panier',
    description: 'Un panier de produits',
    minAmountMinor: 2500n,
    instruments: ['reward_crowdfunding'],
    quantity,
    reserved: 0,
    confirmed: 0,
    estimatedDelivery: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const service = new RewardsService(
    memory.repository,
    memory.recorder,
    memory.transactions,
    new UuidV7Generator(),
    new FixedClock(new Date('2026-10-08T10:00:00Z')),
  );
  return { memory, service };
}

describe('reward reservations', () => {
  it('never takes more than the stock under 50 simultaneous reservations of 10 units', async () => {
    const { memory, service } = setup(10);
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, index) => service.reserve('r-1', `c-${index}`)),
    );
    const refused = results.flatMap((result) =>
      result.status === 'rejected' && result.reason instanceof DomainError
        ? [result.reason.code]
        : [],
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
    expect(refused).toEqual(Array.from({ length: 40 }, () => 'PROJECTS_REWARD_SOLD_OUT'));
    expect(memory.rewards.get('r-1')).toMatchObject({ reserved: 10, confirmed: 0 });
    expect(memory.reservations.size).toBe(10);
    expect(memory.events).toEqual(['projects.reward.sold-out.v1']);
  });

  it('is idempotent by contribution, and settles a reservation once', async () => {
    const { memory, service } = setup(2);
    expect(
      await Promise.all([service.reserve('r-1', 'c-1'), service.reserve('r-1', 'c-1')]),
    ).toEqual(['reserved', 'reserved']);
    expect(memory.rewards.get('r-1')?.reserved).toBe(1);
    expect(await service.confirm('c-1')).toBe('confirmed');
    expect(await service.confirm('c-1')).toBe('confirmed');
    expect(memory.rewards.get('r-1')).toMatchObject({ reserved: 0, confirmed: 1 });
    await service.reserve('r-1', 'c-2');
    await expect(service.reserve('r-1', 'c-3')).rejects.toMatchObject({
      code: 'PROJECTS_REWARD_SOLD_OUT',
    });
    expect(await service.release('c-2')).toBe('released');
    expect(await service.release('c-2')).toBe('released');
    expect(await service.reserve('r-1', 'c-3')).toBe('reserved');
    expect(memory.rewards.get('r-1')).toMatchObject({ reserved: 1, confirmed: 1 });
  });

  it('lets an unlimited reward be reserved without end', async () => {
    const { memory, service } = setup(null);
    await Promise.all(
      Array.from({ length: 30 }, (_, index) => service.reserve('r-1', `c-${index}`)),
    );
    expect(memory.rewards.get('r-1')?.reserved).toBe(30);
    expect(memory.events).toEqual([]);
  });
});
