import { redirect } from 'next/navigation';
import { MemberShell } from '@/components/layout/shells/member-shell';
import { routes } from '@/config/routes';
import { getCurrentMember } from '@/lib/auth/session';
import { RealtimeProvider } from '@/lib/realtime/realtime-provider';

/** Member space: a valid session is required (`GET /v1/me`), the realtime channel is open. */
export default async function MemberLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const [{ locale }, member] = await Promise.all([params, getCurrentMember()]);
  if (!member) redirect(`/${locale}${routes.signIn}`);
  return (
    <RealtimeProvider>
      <MemberShell>{children}</MemberShell>
    </RealtimeProvider>
  );
}
