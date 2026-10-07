import { describe, expect, it } from 'vitest';
import {
  type RenderedEmail,
  renderContributionConfirmationEmail,
  renderEmailVerificationEmail,
  renderMagicLinkEmail,
  renderNewSignInEmail,
  renderOrganizationNoticeEmail,
  type OrganizationNoticeKind,
  renderPasswordResetEmail,
  renderSignInMethodChangedEmail,
  renderTechnicalTestEmail,
} from './index.js';

type Locale = 'fr' | 'en';

interface TemplateCase {
  name: string;
  render: (locale: Locale) => Promise<RenderedEmail>;
  /** Expected subject per locale, and a value that must appear in the body. */
  subjects: Record<Locale, string>;
  mustContain: string;
}

const url = 'https://app.pitchorium.test/action?token=abc';

/** A missing key renders as the key itself; an unresolved parameter keeps its braces. */
const MISSING_TRANSLATION =
  /\{\{|\b(?:layout|providers|emailVerification|magicLink|passwordReset|newSignIn|signInMethodChanged|technicalTest|organizationNotice|contributionConfirmation)\./;

const cases: TemplateCase[] = [
  {
    name: 'technical test',
    render: (locale) => renderTechnicalTestEmail({ locale, sentAt: '2026-10-07T10:00:00.000Z' }),
    subjects: { fr: 'Email de test Pitchorium', en: 'Pitchorium test email' },
    mustContain: '2026-10-07T10:00:00.000Z',
  },
  {
    name: 'email verification',
    render: (locale) =>
      renderEmailVerificationEmail({ locale, name: 'Amina', url, expiresInHours: 24 }),
    subjects: { fr: 'Confirmez votre adresse email', en: 'Confirm your email address' },
    mustContain: url,
  },
  {
    name: 'magic link',
    render: (locale) => renderMagicLinkEmail({ locale, url, expiresInMinutes: 15 }),
    subjects: { fr: 'Votre lien de connexion Pitchorium', en: 'Your Pitchorium sign-in link' },
    mustContain: url,
  },
  {
    name: 'password reset',
    render: (locale) =>
      renderPasswordResetEmail({ locale, name: 'Amina', url, expiresInMinutes: 30 }),
    subjects: { fr: 'Réinitialisation de votre mot de passe', en: 'Reset your password' },
    mustContain: url,
  },
  {
    name: 'new sign-in',
    render: (locale) =>
      renderNewSignInEmail({
        locale,
        name: 'Amina',
        signedInAt: '2026-10-07 10:00',
        device: 'Firefox on Linux',
        securityUrl: url,
      }),
    subjects: { fr: 'Nouvelle connexion à votre compte', en: 'New sign-in to your account' },
    mustContain: 'Firefox on Linux',
  },
  {
    name: 'sign-in method changed',
    render: (locale) =>
      renderSignInMethodChangedEmail({
        locale,
        name: 'Amina',
        change: 'linked',
        provider: 'linkedin',
        changedAt: '2026-10-07 10:00',
        securityUrl: url,
      }),
    subjects: { fr: 'Vos méthodes de connexion ont changé', en: 'Your sign-in methods changed' },
    mustContain: 'LinkedIn',
  },
  {
    name: 'organization invitation',
    render: (locale) =>
      renderOrganizationNoticeEmail({
        locale,
        kind: 'invitation',
        name: null,
        organization: 'Fondation Teranga',
        actionUrl: url,
        role: 'admin',
        member: 'Amina Diop',
        expiresAt: '2026-10-14 10:00',
      }),
    subjects: {
      fr: 'Invitation à rejoindre Fondation Teranga sur Pitchorium',
      en: 'Invitation to join Fondation Teranga on Pitchorium',
    },
    mustContain: url,
  },
  {
    name: 'contribution confirmation',
    render: (locale) =>
      renderContributionConfirmationEmail({
        locale,
        name: 'Amina',
        project: 'Sahel Agri',
        kind: 'reward_crowdfunding',
        amount: '50.00 EUR',
        commission: '2.50 EUR',
        paidAt: '2026-10-07 10:00',
        reward: 'Visite',
        reference: 'ref-1',
        projectUrl: url,
      }),
    subjects: {
      fr: 'Votre contribution à Sahel Agri est confirmée',
      en: 'Your contribution to Sahel Agri is confirmed',
    },
    mustContain: '50.00 EUR',
  },
];

describe('email templates', () => {
  describe.each(cases)('$name', ({ render, subjects, mustContain }) => {
    it.each(['fr', 'en'] as const)('renders %s as html and plain text', async (locale) => {
      const email = await render(locale);

      expect(email.subject).toBe(subjects[locale]);
      expect(email.html).toContain(`lang="${locale}"`);
      expect(email.html).toContain(mustContain.replaceAll('&', '&amp;'));
      expect(email.text).toContain(mustContain);
      // No missing key (rendered as the key itself) and no unresolved parameter.
      expect(email.text).not.toMatch(MISSING_TRANSLATION);
    });
  });

  it('falls back to French for a locale without translations', async () => {
    const email = await renderTechnicalTestEmail({ locale: 'wo', sentAt: 'x' });

    expect(email.subject).toBe('Email de test Pitchorium');
  });

  it('names each change of sign-in method', async () => {
    const changes = ['linked', 'unlinked', 'password_changed', 'password_reset'] as const;
    const texts = await Promise.all(
      changes.map((change) =>
        renderSignInMethodChangedEmail({
          locale: 'en',
          name: 'Amina',
          change,
          provider: 'google',
          changedAt: '2026-10-07 10:00',
          securityUrl: url,
        }).then((email) => email.text),
      ),
    );

    expect(new Set(texts).size).toBe(changes.length);
    expect(texts[2]).toContain('Your password was changed');
  });

  it('renders every organization email in French and English', async () => {
    const kinds: OrganizationNoticeKind[] = [
      'invitation',
      'invitation_accepted',
      'role_changed',
      'ownership_transferred',
      'verification_requested',
      'verification_approved',
      'verification_rejected',
      'verification_revoked',
    ];
    for (const locale of ['fr', 'en'] as const) {
      const emails = await Promise.all(
        kinds.map((kind) =>
          renderOrganizationNoticeEmail({
            locale,
            kind,
            name: 'Amina',
            organization: 'Fondation Teranga',
            actionUrl: url,
            role: 'member',
            member: 'Kofi Mensah',
            reason: 'Statuts fournis et site officiel concordant.',
            expiresAt: '2026-10-14 10:00',
          }),
        ),
      );
      expect(new Set(emails.map((email) => email.subject)).size).toBe(kinds.length);
      for (const email of emails) {
        expect(email.subject).toContain('Fondation Teranga');
        expect(email.text).not.toMatch(MISSING_TRANSLATION);
      }
      expect(emails[6]?.text).toContain('Statuts fournis et site officiel concordant.');
    }
  });

  it('says that the confirmation of a contribution is not a tax receipt', async () => {
    const props = {
      name: 'Amina',
      project: 'Sahel Agri',
      kind: 'donation' as const,
      amount: '65596 XOF',
      commission: '3279 XOF',
      paidAt: '2026-10-07 10:00',
      reference: 'ref-1',
      projectUrl: url,
    };
    const fr = await renderContributionConfirmationEmail({ ...props, locale: 'fr' });
    const en = await renderContributionConfirmationEmail({ ...props, locale: 'en' });

    expect(fr.text).toContain("Ce n'est pas un reçu fiscal.");
    expect(en.text).toContain('It is not a tax receipt.');
  });
});
