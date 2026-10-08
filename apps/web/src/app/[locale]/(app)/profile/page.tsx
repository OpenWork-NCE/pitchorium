import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';
import { getCurrentMember } from '@/lib/auth/session';

/** « Profil » of the member space: the page of the member at its one address (ADR 0101). */
export default async function Page({ params }: PageProps<'/[locale]/profile'>) {
  const [{ locale }, member] = await Promise.all([params, getCurrentMember()]);
  // The layout of the group has already sent a visitor to the sign-in page.
  if (!member) redirect(`/${locale}${routes.signIn}`);
  redirect(`/${locale}${routes.member(member.profile.handle)}`);
}
