import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../platform/kernel';
import { applyFundingDelta, assertGoalMatchesTiers, assertTiers, type TierRecord } from './funding';
import { assertRestrictedMarkdown } from './markdown';
import {
  assertAmountsEditable,
  assertCurrency,
  assertTransition,
  canTransition,
  daysLeft,
  endsAtFor,
  progressPercent,
  type ProjectRecord,
  publicationBlockers,
  type TeamMemberRecord,
} from './project';
import { assertRewardInstruments, assertQuantity, available, type RewardRecord } from './rewards';
import { assertCanGo, assertRoleChange, shownOnPage } from './team';
import { parseVideoUrl, videoView } from './video';

const code = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    throw error;
  }
  return null;
};

const tier = (id: string, threshold: bigint, unlockedAt: Date | null = null): TierRecord => ({
  id,
  projectId: 'p-1',
  position: 1,
  thresholdMinor: threshold,
  description: id,
  unlockedAt,
});

describe('tiers', () => {
  const input = (...thresholds: bigint[]) =>
    thresholds.map((thresholdMinor) => ({ thresholdMinor, description: 'Usage' }));

  it('accepts 1 to 5 cumulative thresholds, strictly increasing', () => {
    expect(code(() => assertTiers(input(1000n)))).toBeNull();
    expect(code(() => assertTiers(input(1000n, 2000n, 5000n, 9000n, 10_000n)))).toBeNull();
    for (const wrong of [
      input(),
      input(1n, 2n, 3n, 4n, 5n, 6n),
      input(2000n, 2000n),
      input(3000n, 2000n),
      input(0n, 2000n),
    ]) {
      expect(code(() => assertTiers(wrong))).toBe('PROJECTS_TIERS_INVALID');
    }
  });

  it('keeps the last threshold equal to the goal', () => {
    expect(code(() => assertGoalMatchesTiers(5000n, input(1000n, 5000n)))).toBeNull();
    expect(code(() => assertGoalMatchesTiers(6000n, input(1000n, 5000n)))).toBe(
      'PROJECTS_TIERS_INVALID',
    );
  });
});

describe('funding', () => {
  const tiers = [tier('t1', 1000n), tier('t2', 3000n), tier('t3', 5000n)];

  it('unlocks every tier reached and makes the project funded at the goal', () => {
    const first = applyFundingDelta(
      { status: 'funding', collectedMinor: 0n, goalMinor: 5000n },
      tiers,
      3500n,
    );
    expect(first).toMatchObject({
      collectedMinor: 3500n,
      status: 'funding',
      unlockedTierIds: ['t1', 't2'],
      funded: false,
    });
    const second = applyFundingDelta(
      { status: 'funding', collectedMinor: 3500n, goalMinor: 5000n },
      [tier('t1', 1000n, new Date()), tier('t2', 3000n, new Date()), tier('t3', 5000n)],
      1500n,
    );
    expect(second).toMatchObject({ status: 'funded', unlockedTierIds: ['t3'], funded: true });
  });

  it('keeps unlocked tiers on a reversal and brings a funded project back to funding', () => {
    const reversed = applyFundingDelta(
      { status: 'funded', collectedMinor: 5000n, goalMinor: 5000n },
      tiers.map((item) => ({ ...item, unlockedAt: new Date() })),
      -2500n,
    );
    expect(reversed).toMatchObject({
      collectedMinor: 2500n,
      status: 'funding',
      unlockedTierIds: [],
      backToFunding: true,
    });
    // A closed project stays closed: the reached tiers stay acquired (flexible funding).
    expect(
      applyFundingDelta({ status: 'closed', collectedMinor: 5000n, goalMinor: 5000n }, [], -10n)
        .status,
    ).toBe('closed');
  });

  it('measures progress and the days left', () => {
    expect(progressPercent(2500n, 5000n)).toBe(50);
    expect(progressPercent(7499n, 5000n)).toBe(149);
    expect(progressPercent(10n, null)).toBe(0);
    const published = new Date('2026-10-01T10:00:00Z');
    const ends = endsAtFor(published, 30);
    expect(ends.toISOString()).toBe('2026-10-31T10:00:00.000Z');
    expect(daysLeft(ends, new Date('2026-10-30T11:00:00Z'))).toBe(1);
    expect(daysLeft(ends, new Date('2026-11-02T00:00:00Z'))).toBe(0);
    expect(daysLeft(null, published)).toBeNull();
  });
});

describe('lifecycle', () => {
  it('follows draft, funding, funded, closed', () => {
    expect(canTransition('draft', 'funding')).toBe(true);
    expect(canTransition('funding', 'funded')).toBe(true);
    expect(canTransition('funded', 'closed')).toBe(true);
    expect(canTransition('funding', 'closed')).toBe(true);
    expect(canTransition('funded', 'funding')).toBe(true);
    for (const [from, to] of [
      ['draft', 'funded'],
      ['draft', 'closed'],
      ['closed', 'funding'],
      ['funding', 'draft'],
    ] as const) {
      expect(code(() => assertTransition(from, to))).toBe('PROJECTS_INVALID_TRANSITION');
    }
  });

  it('lists the fields missing for publication', () => {
    const empty = {
      summary: null,
      description: null,
      sectorCode: null,
      impactArea: null,
      countryCodes: [],
      instruments: [],
      goalMinor: null,
      durationDays: null,
    } as unknown as ProjectRecord;
    expect(publicationBlockers(empty, 0)).toEqual([
      'summary',
      'description',
      'sectorCode',
      'impactArea',
      'countryCodes',
      'instruments',
      'goal',
      'durationDays',
      'tiers',
    ]);
  });

  it('locks the amounts after the first paid contribution, in euros only', () => {
    const project = { firstContributionAt: null } as ProjectRecord;
    expect(code(() => assertAmountsEditable(project))).toBeNull();
    expect(code(() => assertAmountsEditable({ ...project, firstContributionAt: new Date() }))).toBe(
      'PROJECTS_FUNDING_LOCKED',
    );
    expect(code(() => assertCurrency('EUR'))).toBeNull();
    expect(code(() => assertCurrency('XOF'))).toBe('PROJECTS_CURRENCY_NOT_SUPPORTED');
  });
});

describe('rewards', () => {
  const reward = (quantity: number | null, reserved = 0, confirmed = 0) =>
    ({ quantity, reserved, confirmed }) as RewardRecord;

  it('counts the available units of a limited quantity', () => {
    expect(available(reward(null, 5))).toBeNull();
    expect(available(reward(10, 6, 3))).toBe(1);
    expect(available(reward(10, 6, 4))).toBe(0);
    expect(code(() => assertQuantity(reward(10, 6, 3), 8))).toBe('PROJECTS_REWARD_INVALID');
    expect(code(() => assertQuantity(reward(10, 6, 3), 9))).toBeNull();
  });

  it('accepts only instruments of the project', () => {
    expect(code(() => assertRewardInstruments(['donation'], ['donation', 'love_money']))).toBe(
      null,
    );
    expect(code(() => assertRewardInstruments(['reward_crowdfunding'], ['donation']))).toBe(
      'PROJECTS_REWARD_INVALID',
    );
  });
});

describe('team', () => {
  const member = (overrides: Partial<TeamMemberRecord> = {}): TeamMemberRecord => ({
    projectId: 'p-1',
    userId: 'u-1',
    role: 'owner',
    function: null,
    status: 'active',
    invitedBy: null,
    invitedAt: new Date(),
    joinedAt: new Date(),
    publicDisplayConsentAt: null,
    ...overrides,
  });

  it('never leaves a project without an owner', () => {
    expect(code(() => assertCanGo(member(), 1))).toBe('PROJECTS_LAST_OWNER');
    expect(code(() => assertCanGo(member(), 2))).toBeNull();
    expect(code(() => assertCanGo(member({ role: 'editor' }), 1))).toBeNull();
    expect(code(() => assertRoleChange(member(), 'editor', 1))).toBe('PROJECTS_LAST_OWNER');
    expect(code(() => assertRoleChange(member(), 'editor', 2))).toBeNull();
  });

  it('shows on a published page only the members who consented', () => {
    expect(shownOnPage(member(), false)).toBe(false);
    expect(shownOnPage(member({ publicDisplayConsentAt: new Date() }), false)).toBe(true);
    expect(shownOnPage(member(), true)).toBe(true);
    expect(shownOnPage(member({ status: 'invited' }), true)).toBe(false);
  });
});

describe('video', () => {
  it('normalizes YouTube links to youtube-nocookie.com', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(videoView(parseVideoUrl(url))).toEqual({
        provider: 'youtube',
        videoId: 'dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      });
    }
  });

  it('normalizes Vimeo links to player.vimeo.com with dnt=1', () => {
    expect(videoView(parseVideoUrl('https://vimeo.com/76979871')).embedUrl).toBe(
      'https://player.vimeo.com/video/76979871?dnt=1',
    );
    expect(videoView(parseVideoUrl('https://vimeo.com/76979871/a1b2c3d4e5')).embedUrl).toBe(
      'https://player.vimeo.com/video/76979871?dnt=1&h=a1b2c3d4e5',
    );
    expect(parseVideoUrl('https://player.vimeo.com/video/76979871?h=a1b2c3d4e5')).toEqual({
      provider: 'vimeo',
      videoId: '76979871',
      hash: 'a1b2c3d4e5',
    });
  });

  it('refuses other hosts, malformed identifiers and plain http', () => {
    for (const url of [
      'https://www.dailymotion.com/video/x7tgad0',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload=',
      'http://youtu.be/dQw4w9WgXcQ',
      'https://vimeo.com/channels/staffpicks',
      'https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ',
    ]) {
      expect(
        code(() => parseVideoUrl(url)),
        url,
      ).toBe('PROJECTS_VIDEO_URL_INVALID');
    }
  });
});

describe('restricted Markdown of a project', () => {
  it('reports a forbidden construct with the code of the module', () => {
    expect(code(() => assertRestrictedMarkdown('## Histoire\n\nUn **projet**.'))).toBeNull();
    expect(code(() => assertRestrictedMarkdown('<img src=x>'))).toBe(
      'PROJECTS_DESCRIPTION_INVALID',
    );
  });
});
