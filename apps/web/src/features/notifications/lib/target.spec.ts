import { describe, expect, it } from 'vitest';
import { targetHref } from './target';

const target = (path: string) => ({ type: 'post' as const, key: 'k', path });

describe('target of a notification', () => {
  it('opens the delivered pages the api names', () => {
    for (const path of [
      '/posts/0199a0b0-0000-7000-8000-000000000001',
      '/members/aissatou-ba',
      '/messages/0199a0b0-0000-7000-8000-000000000001',
      '/messages?filter=requests',
      '/introductions/0199a0b0-0000-7000-8000-000000000001',
      '/projects',
      '/projects/pompes-solaires-thies',
      '/contributions/0199a0b0-0000-7000-8000-000000000001',
      '/settings/payouts',
      '/dashboard/time',
      '/network',
      '/network?view=suggestions',
      '/network/profile-views',
      '/network/invitations',
      '/events/forum-agriculture-durable',
      '/missions/engagements/0199a0b0-0000-7000-8000-000000000001',
      '/settings/moderation',
      '/settings/moderation#reports',
      '/settings/moderation#decision-0199a0b0-0000-7000-8000-000000000002',
      '/settings/personal-data',
    ]) {
      expect(targetHref(target(path))).toBe(path);
    }
  });

  it('never links a page still to come', () => {
    for (const path of ['/me/moderation', '/settings/moderation#elsewhere', '/discover']) {
      expect(targetHref(target(path))).toBeNull();
    }
  });
});
