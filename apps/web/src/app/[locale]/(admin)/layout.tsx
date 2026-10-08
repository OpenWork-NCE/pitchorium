import { notFound, redirect } from 'next/navigation';
import { AdminShell } from '@/components/layout/shells/admin-shell';
import { routes } from '@/config/routes';
import { getCurrentMember } from '@/lib/auth/session';

/**
 * Administration console: shown to a moderator or an administrator only; the api enforces the
 * role and the second factor on every route (ADR 0015, ADR 0078).
 */
export default async function AdminLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const [{ locale }, member] = await Promise.all([params, getCurrentMember()]);
  if (!member) redirect(`/${locale}${routes.signIn}`);
  if (!member.roles.some((role) => role === 'admin' || role === 'moderator')) notFound();
  return <AdminShell>{children}</AdminShell>;
}
