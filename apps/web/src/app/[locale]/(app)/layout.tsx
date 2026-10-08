import { notificationsControllerCounters } from '@pitchorium/api-client';
import { redirect } from 'next/navigation';
import { MemberShell } from '@/components/layout/member/member-shell';
import { routes } from '@/config/routes';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';

/** The counters of the header, read with the member; the client reads them again if missing. */
async function initialCounters() {
  configureServerApi();
  try {
    return await notificationsControllerCounters({ cache: 'no-store' });
  } catch {
    return null;
  }
}

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
