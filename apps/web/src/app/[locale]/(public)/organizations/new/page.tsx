import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import { routes } from '@/config/routes';
import { CreateOrganization } from '@/features/organizations';
import { asLocale } from '@/i18n/routing';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.organizations.create');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Creation of an organisation (§10.7): a member only, the email verified when it is sent. */
export default async function Page({ params }: PageProps<'/[locale]/organizations/new'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!(await getCurrentMember())) {
    redirect(withRedirect(`/${locale}${routes.signIn}`, `/${locale}${routes.createOrganization}`));
  }
  const t = await getTranslations('web.organizations.create');
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{t('description')}</Text>
        </div>
        <CreateOrganization />
      </div>
    </SingleColumnLayout>
  );
}
