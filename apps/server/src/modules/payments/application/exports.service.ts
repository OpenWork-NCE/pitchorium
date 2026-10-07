import { Injectable } from '@nestjs/common';
import { Money } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import { type ContributionRecord, wasPaid } from '../domain/contribution';
import { EUR } from '../domain/fx';
import type { OfflineContributionRecord } from '../domain/offline';
import { PaymentsRepository } from './ports';

const PAGE = 500;

const COLUMNS = [
  'type',
  'date',
  'contributor',
  'organization',
  'kind',
  'status',
  'currency',
  'amount',
  'eur_equivalent',
  'commission',
  'provider_fee',
  'refunded',
  'holder_net',
  'reward',
  'reward_state',
  'reference',
] as const;

/**
 * A cell of a CSV file (RFC 4180), protected against formula injection: a value starting with
 * `=`, `+`, `-` or `@` is prefixed with an apostrophe when it is text.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csvLine(cells: readonly string[]): string {
  return `${cells.map(csvCell).join(',')}\r\n`;
}

/**
 * Export of a project for its owners (section 11.3): paid contributions and off-platform
 * contributions and commitments, with the commission, the fees and the state of the reward.
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly projects: ProjectsFacade,
    private readonly profiles: ProfilesFacade,
  ) {}

  async projectCsv(projectId: string): Promise<string> {
    const contributions: ContributionRecord[] = [];
    let after: { at: Date; key: string } | null = null;
    for (;;) {
      const page = await this.payments.contributions({ projectId }, after, PAGE);
      contributions.push(...page);
      const last = page.at(-1);
      if (page.length < PAGE || !last) break;
      after = { at: last.createdAt, key: last.id };
    }
    const offline: OfflineContributionRecord[] = [];
    let offlineAfter: { at: Date; key: string } | null = null;
    for (;;) {
      const page = await this.payments.offlineContributions({ projectId }, offlineAfter, PAGE);
      offline.push(...page);
      const last = page.at(-1);
      if (page.length < PAGE || !last) break;
      offlineAfter = { at: last.createdAt, key: last.id };
    }
    const paid = contributions.filter((row) => wasPaid(row.status));
    const [cards, rewards] = await Promise.all([
      this.profiles.memberCards([
        ...paid.filter((row) => !row.anonymous).map((row) => row.contributorId),
        ...offline.map((row) => row.contributorId),
      ]),
      Promise.all(
        [...new Set(paid.flatMap((row) => (row.rewardId ? [row.rewardId] : [])))].map((id) =>
          this.projects.reward(id),
        ),
      ),
    ]);
    const nameOf = (userId: string) => cards.get(userId)?.displayName ?? '';
    const rewardOf = (id: string | null) =>
      rewards.find((reward) => reward?.id === id)?.title ?? '';
    let csv = csvLine(COLUMNS);
    for (const row of paid) {
      const money = (minor: bigint) => Money.of(minor, row.currency).toDecimal();
      const commission = row.commissionMinor - row.commissionRefundedMinor;
      const fee = row.providerFeeMinor ?? 0n;
      const net = row.amountMinor - row.refundedMinor - row.lostMinor - commission - fee;
      csv += csvLine([
        'online',
        (row.succeededAt ?? row.createdAt).toISOString(),
        row.anonymous ? 'anonymous' : nameOf(row.contributorId),
        row.organizationId ?? '',
        row.kind,
        row.status,
        row.currency,
        money(row.amountMinor),
        Money.of(row.eurMinor, EUR).toDecimal(),
        money(commission),
        row.providerFeeMinor === null ? '' : money(row.providerFeeMinor),
        money(row.refundedMinor),
        money(net),
        rewardOf(row.rewardId),
        row.rewardState,
        row.id,
      ]);
    }
    for (const row of offline) {
      const amount =
        row.amountMinor !== null && row.currency
          ? Money.of(row.amountMinor, row.currency).toDecimal()
          : '';
      csv += csvLine([
        'offline',
        row.createdAt.toISOString(),
        nameOf(row.contributorId),
        '',
        row.kind,
        row.status,
        row.currency ?? '',
        amount,
        row.eurMinor === null ? '' : Money.of(row.eurMinor, EUR).toDecimal(),
        '',
        '',
        '',
        amount,
        '',
        '',
        row.id,
      ]);
    }
    return csv;
  }
}
