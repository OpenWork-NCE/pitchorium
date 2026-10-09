import { routes } from '@/config/routes';
import { authCall } from '../../lib/auth-call';
import { absoluteUrl, continuePath } from './targets';

/** Asks the api for a sign-in link (also used by the resend of the email-sent screen). */
export async function sendMagicLink(
  locale: string,
  email: string,
  redirectTo: string | null,
  captcha: string | null,
) {
  const { authClient } = await import('@/lib/auth/client');
  return authCall(
    (fetchOptions) =>
      authClient.signIn.magicLink({
        email,
        callbackURL: absoluteUrl(locale, continuePath(redirectTo)),
        newUserCallbackURL: absoluteUrl(locale, routes.onboarding),
        errorCallbackURL: absoluteUrl(locale, `${routes.emailVerified}?kind=magic`),
        fetchOptions,
      }),
    captcha,
  );
}
