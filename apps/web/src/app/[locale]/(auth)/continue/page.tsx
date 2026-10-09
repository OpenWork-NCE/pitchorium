import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';
import { getCurrentMember } from '@/lib/auth/session';
import { REDIRECT_PARAM, safeRedirect, withRedirect } from '@/lib/auth/redirect';
import { firstParam } from '@/lib/search-params';

/**
 * Where every sign-in lands (OAuth, link, password, second factor): the terms in force first
 * (§7.2, for every method), then the page asked for, validated on this origin, else the feed.
 */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/continue'>) {
  const [{ locale }, query, member] = await Promise.all([params, searchParams, getCurrentMember()]);
  const target = safeRedirect(firstParam(query, REDIRECT_PARAM), `/${locale}${routes.feed}`);
  if (!member) redirect(withRedirect(`/${locale}${routes.signIn}`, target));
  if (!member.legal.upToDate) redirect(withRedirect(`/${locale}${routes.onboardingTerms}`, target));
  redirect(target);
}
