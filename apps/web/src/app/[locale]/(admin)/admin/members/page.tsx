import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPlaceholder } from '@/components/layout/admin/admin-placeholder';
import { asLocale } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.nav');
  return { title: t('members'), robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/admin/members'>) {
  setRequestLocale(asLocale((await params).locale));
  return <AdminPlaceholder section="members" />;
}
