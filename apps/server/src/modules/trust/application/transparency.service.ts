import { Injectable } from '@nestjs/common';
import type { TransparencyReport } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { TrustRepository } from './ports';

/** Longest period of one transparency report. */
const MAX_PERIOD_DAYS = 366;

/**
 * Aggregated transparency counters (reports, decisions, delays, appeals) over a period, for
 * the administrators: the basis of a transparency report, never personal data.
 */
@Injectable()
export class TransparencyService {
  constructor(private readonly trust: TrustRepository) {}

  async report(from: string, to: string): Promise<TransparencyReport> {
    const start = new Date(`${from}T00:00:00Z`);
    // The `to` day is included.
    const end = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000);
    if (end <= start || end.getTime() - start.getTime() > MAX_PERIOD_DAYS * 86_400_000) {
      throw new DomainError(
        'BAD_REQUEST',
        `The period must last from 1 to ${MAX_PERIOD_DAYS} days`,
      );
    }
    const counts = await this.trust.transparency(start, end);
    return {
      from,
      to,
      reports: counts.reports,
      cases: {
        opened: counts.cases.opened,
        fromSignals: counts.cases.fromSignals,
        resolved: counts.cases.resolved,
        medianResolutionHours: median(counts.cases.resolutionHours),
      },
      decisions: { byKind: counts.decisions },
      suspensions: counts.suspensions,
      appeals: counts.appeals,
    };
  }
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return Math.round(value * 10) / 10;
}
