import { describe, expect, it } from 'vitest';
import { fundingState } from './funding-state';

const eur = (euros: number) => ({ amountMinor: String(euros * 100), currency: 'EUR' });
const funding = (collected: number, daysLeft: number | null, goal: number | null = 20_000) => ({
  goal: goal === null ? null : eur(goal),
  collected: eur(collected),
  daysLeft,
});

describe('the funding block of a project', () => {
  it('shows the duration of a draft, counted from its publication', () => {
    expect(fundingState('draft', funding(0, null), { durationDays: 45 })).toEqual({
      open: false,
      goalReached: false,
      outcome: 'draft',
      time: { kind: 'duration', days: 45 },
      frozen: false,
    });
  });

  it('counts the days left of an open campaign, then its last day', () => {
    expect(fundingState('funding', funding(12_500, 12))).toMatchObject({
      open: true,
      goalReached: false,
      outcome: 'funding',
      time: { kind: 'daysLeft', days: 12 },
    });
    expect(fundingState('funding', funding(12_500, 0)).time).toEqual({ kind: 'lastDay' });
  });

  it('keeps a funded campaign open until its end, its goal exceeded', () => {
    expect(fundingState('funded', funding(24_000, 5))).toMatchObject({
      open: true,
      goalReached: true,
      outcome: 'funded',
      time: { kind: 'daysLeft', days: 5 },
    });
  });

  it('closes a campaign at its end, with its outcome', () => {
    expect(fundingState('closed', funding(21_000, 0))).toMatchObject({
      open: false,
      outcome: 'closed_funded',
      time: { kind: 'ended' },
    });
    expect(fundingState('closed', funding(8_000, 0))).toMatchObject({
      open: false,
      goalReached: false,
      outcome: 'closed',
    });
  });

  it('stops the contributions of a campaign frozen by the moderation, its status kept', () => {
    expect(fundingState('funding', funding(1_000, 20), { frozen: true })).toMatchObject({
      open: false,
      frozen: true,
      outcome: 'funding',
    });
  });

  it('never says a goal is reached without a goal', () => {
    expect(fundingState('draft', funding(0, null, null)).goalReached).toBe(false);
  });
});
