// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/support/render';
import { oauthFailureOf } from './auth-error-screen';
import { AuthErrorScreen } from './auth-error-screen';
import { remainingSeconds } from './check-email-screen';
import { LegalAcceptanceForm } from '../onboarding/legal-acceptance-form';
import { PasswordSignInScreen } from './password-sign-in-screen';
import { SignInScreen } from './sign-in-screen';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/sign-in',
}));

const config = {
  oauthProviders: [] as ('google' | 'linkedin' | 'microsoft')[],
  turnstile: null,
  legal: { termsVersion: 'v1', privacyVersion: 'v1', minimumAge: 18 },
  minPasswordLength: 12,
};

describe('authentication screens', () => {
  it('shows the providers enabled, in the order of §7.2, the email path second', () => {
    renderWithProviders(
      <SignInScreen
        config={{ ...config, oauthProviders: ['google', 'linkedin', 'microsoft'] }}
        redirectTo={null}
      />,
    );
    // Four entries of the same weight, the email one leading to its step; no stacked links.
    const entries = [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('link', { name: 'Continuer avec un email' }),
    ];
    expect(entries.map((entry) => entry.textContent)).toEqual([
      'Continuer avec Google',
      'Continuer avec LinkedIn',
      'Continuer avec Microsoft',
      'Continuer avec un email',
    ]);
    expect(new Set(entries.map((entry) => entry.className.includes('h-12')))).toEqual(
      new Set([true]),
    );
    expect(screen.getByRole('link', { name: 'Continuer avec un email' }).getAttribute('href')).toBe(
      '/sign-in/email',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByLabelText('Mot de passe')).toBeNull();
  });

  it('opens on the email step without any provider: a link by default, a password on request', () => {
    renderWithProviders(<SignInScreen config={config} redirectTo="/fr/projects" />);
    expect(screen.getByLabelText('Adresse email').getAttribute('autocomplete')).toBe('email');
    expect(screen.getByRole('button', { name: 'Recevoir un lien de connexion' })).toBeTruthy();
    expect(screen.queryByLabelText('Mot de passe')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Utiliser un mot de passe' }).getAttribute('href'),
    ).toBe('/sign-in/password?redirectTo=%2Ffr%2Fprojects');
  });

  it('signs in with a password with the attributes of password managers', () => {
    renderWithProviders(<PasswordSignInScreen config={config} redirectTo={null} />);
    expect(screen.getByLabelText('Adresse email').getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Mot de passe').getAttribute('autocomplete')).toBe(
      'current-password',
    );
    expect(screen.getByRole('link', { name: 'Recevoir plutôt un lien' }).getAttribute('href')).toBe(
      '/sign-in/email',
    );
  });

  it('explains each failure of a provider, and how to link an existing account', () => {
    expect(oauthFailureOf('access_denied')).toBe('denied');
    expect(oauthFailureOf('email_not_verified')).toBe('unverified');
    expect(oauthFailureOf('account_not_linked')).toBe('notLinkable');
    expect(oauthFailureOf('state_mismatch')).toBe('generic');
    expect(oauthFailureOf(null)).toBe('generic');
    renderWithProviders(<AuthErrorScreen error="account_not_linked" />);
    expect(screen.getByRole('heading', { name: 'Cette adresse a déjà un compte' })).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Se connecter, puis relier le compte' })
        .getAttribute('href'),
    ).toBe('/sign-in?redirectTo=%2Fsettings%2Faccount');
  });

  it('counts down the resend of an email, never below zero', () => {
    expect(remainingSeconds(0, 0)).toBe(60);
    expect(remainingSeconds(0, 59_100)).toBe(1);
    expect(remainingSeconds(0, 120_000)).toBe(0);
  });

  it('renders the rich texts of the terms, never their tags', () => {
    // The Radix checkbox measures itself; jsdom has no ResizeObserver.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    renderWithProviders(
      <LegalAcceptanceForm
        versions={{ termsVersion: 'v1', privacyVersion: 'v2', minimumAge: 18 }}
        onAccepted={() => undefined}
      />,
    );
    const terms = screen.getByRole('checkbox', { name: /conditions d’utilisation \(version v1\)/ });
    expect(terms).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/<\/?link>/);
  });
});
