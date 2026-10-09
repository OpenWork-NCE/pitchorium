import { redirect } from 'next/navigation';
import { DataProvider } from '@/components/layout/data-provider';
import { routes } from '@/config/routes';
import { getCurrentMember } from '@/lib/auth/session';
import { withRedirect } from '@/lib/auth/redirect';

/** Onboarding (§7.2): a session is required; the writes go from the browser to the api. */
export default async function OnboardingLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const [{ locale }, member] = await Promise.all([params, getCurrentMember()]);
  if (!member)
    redirect(withRedirect(`/${locale}${routes.signIn}`, `/${locale}${routes.onboarding}`));
  return <DataProvider>{children}</DataProvider>;
}
