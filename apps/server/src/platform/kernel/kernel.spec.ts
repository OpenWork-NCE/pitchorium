import { describe, expect, it } from 'vitest';
import { FixedClock, SystemClock } from './clock';
import { DomainError } from './domain-error';
import { DomainEvent, isValidEventType } from './domain-event';
import { UuidV7Generator } from './ids';
import { slugCandidates, slugify } from './slug';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UuidV7Generator', () => {
  it('generates distinct, time-ordered UUIDv7', () => {
    const ids = new UuidV7Generator();
    const generated = Array.from({ length: 100 }, () => ids.next());
    expect(generated.every((id) => UUID_V7.test(id))).toBe(true);
    expect(new Set(generated).size).toBe(100);
    expect([...generated].sort()).toEqual(generated);
  });
});

describe('clocks', () => {
  it('SystemClock returns the current time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('FixedClock is controllable and returns defensive copies', () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00Z'));
    clock.now().setFullYear(2000);
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    clock.advance(1500);
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:01.500Z');
    clock.set(new Date('2027-06-01T12:00:00Z'));
    expect(clock.now().toISOString()).toBe('2027-06-01T12:00:00.000Z');
  });
});

describe('DomainError', () => {
  it('carries a registry code, a message and details', () => {
    class CampaignClosed extends DomainError {}
    const error = new CampaignClosed('CONFLICT', 'Campaign is closed', { campaignId: 'c1' });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CampaignClosed');
    expect(error.code).toBe('CONFLICT');
    expect(error.details).toEqual({ campaignId: 'c1' });
    expect(new DomainError('NOT_FOUND', 'x').details).toEqual({});
  });
});

describe('DomainEvent', () => {
  class Pinged extends DomainEvent<{ note: string }> {
    readonly type = 'platform.ping.v1';
    readonly aggregateType = 'platform';

    constructor(note: string) {
      super({ id: 'e1', aggregateId: 'a1', occurredAt: new Date(0), payload: { note } });
    }
  }

  it('exposes identity, aggregate, time and payload', () => {
    const event = new Pinged('hello');
    expect(event).toMatchObject({
      id: 'e1',
      type: 'platform.ping.v1',
      aggregateType: 'platform',
      aggregateId: 'a1',
      payload: { note: 'hello' },
    });
    expect(event.occurredAt.getTime()).toBe(0);
  });

  it.each([
    ['projects.campaign.published.v1', true],
    ['payments.contribution-refund.paid.v12', true],
    ['projects.campaign.published', false],
    ['Projects.campaign.published.v1', false],
    ['campaign.v0', false],
  ])('validates event type %s', (type, valid) => {
    expect(isValidEventType(type)).toBe(valid);
  });
});

describe('slugs', () => {
  const options = { minLength: 3, maxLength: 20, fallback: 'item', reserved: new Set(['admin']) };

  it('turns a free text into a slug, without accents', () => {
    const wide = { ...options, maxLength: 40 };
    expect(slugify('  Aminata Diallo-Ndiaye ', wide)).toBe('aminata-diallo-ndiaye');
    expect(slugify('Économie & Société', wide)).toBe('economie-societe');
  });

  it('cuts a long text at a word boundary when one is available', () => {
    // Room for 13 characters: "fondation-pou" would cut a word.
    expect(slugify('Fondation pour Demain', options)).toBe('fondation');
    // The 14th character is a hyphen: the cut falls between two words.
    expect(slugify('Association-x abc', options)).toBe('association-x');
    // No boundary far enough: the word itself is cut.
    expect(slugify('Ab-Supercalifragilistic', options)).toBe('ab-supercalif');
  });

  it('falls back for a text too short or giving a reserved slug', () => {
    expect(slugify('Æ', options)).toBe('item');
    expect(slugify('!!', options)).toBe('item');
    expect(slugify('Admin', options)).toBe('item');
  });

  it('proposes the base, numbered then random candidates', () => {
    let random = 100;
    const candidates = [...slugCandidates('ngo', () => (random += 1))];
    expect(candidates.slice(0, 3)).toEqual(['ngo', 'ngo-2', 'ngo-3']);
    expect(candidates).toHaveLength(14);
    expect(candidates.slice(-2)).toEqual(['ngo-104', 'ngo-105']);
  });
});
