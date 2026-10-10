import { describe, expect, it } from 'vitest';
import { tierIssues } from './tiers';

const tier = (euros: number | null, description = 'Usage des fonds') => ({
  thresholdMinor: euros === null ? null : String(euros * 100),
  description,
});

describe('live check of the tiers', () => {
  it('accepts 1 to 5 increasing thresholds, the last one the goal', () => {
    expect(tierIssues([tier(5_000), tier(12_000), tier(20_000)], '2000000')).toEqual({
      list: [],
      tiers: [],
    });
    expect(tierIssues([tier(20_000)], '2000000')).toEqual({ list: [], tiers: [] });
  });

  it('says how many tiers are allowed and that the goal is needed', () => {
    expect(tierIssues([], '2000000').list).toEqual(['too_few']);
    expect(
      tierIssues(
        [1, 2, 3, 4, 5, 6].map((step) => tier(step * 1000)),
        '600000',
      ).list,
    ).toEqual(['too_many']);
    expect(tierIssues([tier(1_000)], null).list).toEqual(['goal_required']);
  });

  it('places each issue on its tier', () => {
    expect(
      tierIssues([tier(5_000), tier(5_000), tier(null, ''), tier(19_000)], '2000000').tiers,
    ).toEqual([
      { index: 1, issue: 'not_increasing' },
      { index: 2, issue: 'description_required' },
      { index: 2, issue: 'threshold_required' },
      { index: 3, issue: 'last_not_goal' },
    ]);
    expect(tierIssues([tier(25_000), tier(30_000)], '2500000').tiers).toEqual([
      { index: 0, issue: 'above_goal' },
      { index: 1, issue: 'last_not_goal' },
    ]);
    expect(tierIssues([tier(0)], '2000000').tiers).toEqual([
      { index: 0, issue: 'threshold_positive' },
    ]);
    expect(tierIssues([tier(20_000, 'x'.repeat(501))], '2000000').tiers).toEqual([
      { index: 0, issue: 'description_too_long' },
    ]);
  });
});
