import { Injectable } from '@nestjs/common';
import type { CreateRewardRequest, UpdateRewardRequest } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import {
  assertAmountsEditable,
  assertCurrency,
  isOpen,
  type ProjectRecord,
} from '../domain/project';
import { RewardCreated, RewardSoldOut, RewardUpdated } from '../domain/project-events';
import {
  assertAvailable,
  assertQuantity,
  assertRewardInstruments,
  available,
  type ReservationRecord,
  type ReservationStatus,
  type RewardRecord,
} from '../domain/rewards';
import { ProjectEventsRecorder } from './project-events.recorder';
import { ProjectRepository, type RewardPatch } from './ports';

const rewardNotFound = () => new DomainError('PROJECTS_REWARD_NOT_FOUND', 'Reward not found');
const reservationNotFound = () =>
  new DomainError('PROJECTS_RESERVATION_NOT_FOUND', 'Reward reservation not found');

/**
 * Rewards of a project (section 11.3) and the reservation of limited quantities (ADR 0041):
 * `reserve`, `confirm` and `release` are idempotent by contribution and serialised on the
 * reward row, so that concurrent contributions never take more units than the stock.
 */
@Injectable()
export class RewardsService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly events: ProjectEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async create(projectId: string, request: CreateRewardRequest): Promise<RewardRecord> {
    const project = await this.requireProject(projectId);
    assertCurrency(request.minAmount.currency);
    assertRewardInstruments(request.instruments, project.instruments);
    const now = this.clock.now();
    const reward: RewardRecord = {
      id: this.ids.next(),
      projectId,
      title: request.title,
      description: request.description,
      minAmountMinor: BigInt(request.minAmount.amountMinor),
      instruments: request.instruments,
      quantity: request.quantity ?? null,
      reserved: 0,
      confirmed: 0,
      estimatedDelivery: request.estimatedDelivery ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.transactions.run(async () => {
      await this.projects.insertReward(reward);
      await this.events.record(RewardCreated, projectId, { rewardId: reward.id });
    });
    return reward;
  }

  /** The minimum amount is locked after the first paid contribution; texts stay editable. */
  async update(projectId: string, rewardId: string, request: UpdateRewardRequest): Promise<void> {
    const fields = Object.keys(request).sort();
    if (fields.length === 0) return;
    const project = await this.requireProject(projectId);
    await this.transactions.run(async () => {
      const reward = await this.lockReward(projectId, rewardId);
      const patch: RewardPatch = {};
      if (request.title !== undefined) patch.title = request.title;
      if (request.description !== undefined) patch.description = request.description;
      if (request.minAmount !== undefined) {
        assertCurrency(request.minAmount.currency);
        const minAmountMinor = BigInt(request.minAmount.amountMinor);
        if (minAmountMinor !== reward.minAmountMinor) {
          assertAmountsEditable(project);
          patch.minAmountMinor = minAmountMinor;
        }
      }
      if (request.instruments !== undefined) {
        assertRewardInstruments(request.instruments, project.instruments);
        patch.instruments = request.instruments;
      }
      if (request.quantity !== undefined) {
        assertQuantity(reward, request.quantity);
        patch.quantity = request.quantity;
      }
      if (request.estimatedDelivery !== undefined) {
        patch.estimatedDelivery = request.estimatedDelivery;
      }
      await this.projects.updateReward(rewardId, patch, this.clock.now());
      await this.events.record(RewardUpdated, projectId, { rewardId, fields });
    });
  }

  async delete(projectId: string, rewardId: string): Promise<void> {
    await this.transactions.run(async () => {
      await this.lockReward(projectId, rewardId);
      if ((await this.projects.countReservations(rewardId)) > 0) {
        throw new DomainError('PROJECTS_REWARD_IN_USE', 'The reward has reservations');
      }
      await this.projects.deleteReward(rewardId);
      await this.events.record(RewardUpdated, projectId, { rewardId, fields: ['deleted'] });
    });
  }

  /**
   * Takes one unit for a contribution of an open project. Replaying the same contribution
   * returns its reservation; PROJECTS_REWARD_SOLD_OUT when no unit is left.
   */
  reserve(rewardId: string, contributionId: string): Promise<ReservationStatus> {
    return this.transactions.run(async () => {
      const reward = await this.projects.lockReward(rewardId);
      if (!reward) throw rewardNotFound();
      const existing = await this.projects.findReservation(contributionId);
      if (existing) {
        if (existing.rewardId !== rewardId) {
          throw new DomainError(
            'PROJECTS_CONTRIBUTION_CONFLICT',
            'The contribution reserved another reward',
          );
        }
        return existing.status;
      }
      const project = await this.projects.findProject(reward.projectId);
      if (!project || project.deletedAt || !isOpen(project)) {
        throw new DomainError('PROJECTS_NOT_OPEN', 'The project is not open to contributions');
      }
      assertAvailable(reward);
      const now = this.clock.now();
      const reservation: ReservationRecord = {
        contributionId,
        rewardId,
        status: 'reserved',
        createdAt: now,
        updatedAt: now,
      };
      await this.projects.insertReservation(reservation);
      const reserved = reward.reserved + 1;
      await this.projects.updateReward(rewardId, { reserved }, now);
      if (available({ ...reward, reserved }) === 0) {
        await this.events.record(RewardSoldOut, reward.projectId, { rewardId });
      }
      return reservation.status;
    });
  }

  /** The contribution was paid: its unit is definitively taken. */
  confirm(contributionId: string): Promise<ReservationStatus> {
    return this.settle(contributionId, 'confirmed');
  }

  /** The contribution failed or was refunded: its unit is available again. */
  release(contributionId: string): Promise<ReservationStatus> {
    return this.settle(contributionId, 'released');
  }

  private settle(
    contributionId: string,
    target: 'confirmed' | 'released',
  ): Promise<ReservationStatus> {
    return this.transactions.run(async () => {
      const found = await this.projects.findReservation(contributionId);
      if (!found) throw reservationNotFound();
      const reward = await this.projects.lockReward(found.rewardId);
      if (!reward) throw rewardNotFound();
      // Read again under the lock of the reward: a concurrent settlement may have won.
      const reservation = await this.projects.findReservation(contributionId);
      if (!reservation) throw reservationNotFound();
      if (reservation.status === target) return target;
      if (reservation.status === 'released') throw reservationNotFound();
      const now = this.clock.now();
      const patch: RewardPatch =
        target === 'confirmed'
          ? { reserved: reward.reserved - 1, confirmed: reward.confirmed + 1 }
          : reservation.status === 'confirmed'
            ? { confirmed: reward.confirmed - 1 }
            : { reserved: reward.reserved - 1 };
      await this.projects.updateReward(reward.id, patch, now);
      await this.projects.setReservationStatus(contributionId, target, now);
      return target;
    });
  }

  private async requireProject(projectId: string): Promise<ProjectRecord> {
    const project = await this.projects.findProject(projectId);
    if (!project || project.deletedAt) {
      throw new DomainError('PROJECTS_NOT_FOUND', 'Project not found');
    }
    return project;
  }

  private async lockReward(projectId: string, rewardId: string): Promise<RewardRecord> {
    const reward = await this.projects.lockReward(rewardId);
    if (!reward || reward.projectId !== projectId) throw rewardNotFound();
    return reward;
  }
}
