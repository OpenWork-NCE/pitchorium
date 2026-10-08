import { redirect } from 'next/navigation';
import { initialCounters } from '@/components/layout/member/initial-counters';
import { MemberShell } from '@/components/layout/member/member-shell';
import { routes } from '@/config/routes';
import { getCurrentMember } from '@/lib/auth/session';

/** Member space: a valid session is required (`GET /v1/me`), the realtime channel is open. */
export default async function MemberLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const [{ locale }, member, counters] = await Promise.all([
    params,
    getCurrentMember(),
    initialCounters(),
  ]);
  if (!member) redirect(`/${locale}${routes.signIn}`);
  return (
    <MemberShell member={member} counters={counters}>
      {children}
    </MemberShell>
  );
}
