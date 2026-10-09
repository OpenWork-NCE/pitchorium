import { notFound, redirect } from 'next/navigation';
import { AdminShell } from '@/components/layout/admin/admin-shell';
import { routes } from '@/config/routes';
import { getCurrentMember } from '@/lib/auth/session';

/**
 * Administration console: shown to a moderator or an administrator only, checked here before the
 * render, and only once their second factor is on; the api enforces the role and the second factor
 * on every route (ADR 0015, ADR 0078).
 */
export default async function AdminLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const [{ locale }, member] = await Promise.all([params, getCurrentMember()]);
  if (!member) redirect(`/${locale}${routes.signIn}`);
  if (!member.roles.some((role) => role === 'admin' || role === 'moderator')) notFound();
  // A privileged role works only with a second factor (ADR 0015): guided to turn it on first.
  if (!member.user.twoFactorEnabled) {
    redirect(`/${locale}${routes.settingsSecurity}?required=two-factor`);
  }
  return <AdminShell>{children}</AdminShell>;
}
