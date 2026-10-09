import { accessControllerPrerequisites } from '@pitchorium/api-client';
import { notFound, redirect } from 'next/navigation';
import { AdminShell } from '@/components/layout/admin/admin-shell';
import { routes } from '@/config/routes';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';

/**
 * Administration console: what the api answers for its moderation queue, the action every
 * privileged role holds, decides before the render (ADR 0015, ADR 0078, ADR 0109). Without the
 * role, the console does not exist (404); with the role but without its second factor, the member
 * is guided to turn it on. The api enforces both on every route.
 */
export default async function AdminLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const [{ locale }, member] = await Promise.all([params, getCurrentMember()]);
  if (!member) redirect(`/${locale}${routes.signIn}`);
  configureServerApi();
  const access = await accessControllerPrerequisites('trust.moderation.read', {
    cache: 'no-store',
  });
  if (access.code === 'FORBIDDEN' || access.code === 'UNAUTHENTICATED') notFound();
  if (access.missing.includes('two_factor')) {
    redirect(`/${locale}${routes.settingsSecurity}?required=two-factor`);
  }
  return <AdminShell>{children}</AdminShell>;
}
