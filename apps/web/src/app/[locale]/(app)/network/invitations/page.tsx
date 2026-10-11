import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import { OrganizationInvitations } from '@/features/organizations';
import { LazyProjectInvitations } from '@/features/projects';
import { asLocale } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.network.joinInvitations');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * « Invitations » (ADR 0149): the invitations to join an organisation, sent to the verified email
 * of the member, and those to join the team of a project, answered here without the email.
 */
export default async function Page({ params }: PageProps<'/[locale]/network/invitations'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web.network.joinInvitations');
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-8">
        <div className="grid gap-2">
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{t('description')}</Text>
        </div>
        <OrganizationInvitations />
        <LazyProjectInvitations showEmpty />
      </div>
    </SingleColumnLayout>
  );
}
