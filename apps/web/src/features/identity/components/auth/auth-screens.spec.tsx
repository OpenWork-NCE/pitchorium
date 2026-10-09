// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/support/render';
import { oauthFailureOf } from './auth-error-screen';
import { AuthErrorScreen } from './auth-error-screen';
import { remainingSeconds } from './check-email-screen';
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
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.slice(0, 4)).toEqual([
      'Continuer avec Google',
      'Continuer avec LinkedIn',
      'Continuer avec Microsoft',
      'Continuer avec un email',
    ]);
    expect(screen.queryByLabelText('Mot de passe')).toBeNull();
  });

  it('opens on the email form when no provider is enabled, with the attributes of password managers', () => {
    renderWithProviders(<SignInScreen config={config} redirectTo="/fr/projects" />);
    expect(screen.getByLabelText('Adresse email').getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Mot de passe').getAttribute('autocomplete')).toBe(
      'current-password',
    );
    expect(screen.getByRole('link', { name: /Créer un compte/ }).getAttribute('href')).toBe(
      '/sign-up?redirectTo=%2Ffr%2Fprojects',
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
});
