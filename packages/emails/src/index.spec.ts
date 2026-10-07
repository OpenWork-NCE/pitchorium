import { describe, expect, it } from 'vitest';
import { renderTechnicalTestEmail } from './index.js';

describe('renderTechnicalTestEmail', () => {
  it.each([
    ['fr', 'Email de test Pitchorium', 'Email de test'],
    ['en', 'Pitchorium test email', 'Test email'],
  ] as const)('renders the %s version as html and plain text', async (locale, subject, heading) => {
    const sentAt = '2026-10-07T10:00:00.000Z';

    const email = await renderTechnicalTestEmail({ locale, sentAt });

    expect(email.subject).toBe(subject);
    expect(email.html).toContain(`lang="${locale}"`);
    expect(email.html).toContain(heading);
    expect(email.text).toContain(sentAt);
    expect(email.html).not.toContain('{{');
  });

  it('falls back to French for a locale without translations', async () => {
    const email = await renderTechnicalTestEmail({ locale: 'wo', sentAt: 'x' });

    expect(email.subject).toBe('Email de test Pitchorium');
  });
});
