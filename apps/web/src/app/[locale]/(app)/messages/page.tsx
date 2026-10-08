import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SectionPlaceholder } from '@/components/layout/member/section-placeholder';
import { asLocale } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.nav');
  return { title: t('messages'), robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/messages'>) {
  setRequestLocale(asLocale((await params).locale));
  return <SectionPlaceholder section="messages" />;
}
