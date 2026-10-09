import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Link } from '@/components/ui';
import { routes } from '@/config/routes';
import { OrganizationManage } from '@/features/organizations';
import { asLocale } from '@/i18n/routing';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';
import { firstParam } from '@/lib/search-params';
import { readOrganization } from '../read-organization';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.organizations.manage');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Management of an organisation by its members (§10.7): absent for a reader who is not one
 * (ADR 0101); the api decides each action by the role.
 */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/organizations/[slug]/manage'>) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const member = await getCurrentMember();
  if (!member) {
    redirect(
      withRedirect(`/${locale}${routes.signIn}`, `/${locale}${routes.organizationManage(slug)}`),
    );
  }
  const resource = await readOrganization(slug);
  if (!resource || resource.data.viewerRole === null) notFound();
  const organization = resource.data;
  if (organization.slug !== slug) {
    permanentRedirect(`/${locale}${routes.organizationManage(organization.slug)}`);
  }
  const t = await getTranslations('web.organizations.manage');
  return (
    <SingleColumnLayout>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Link
            href={routes.organization(organization.slug)}
            variant="standalone"
            className="text-sm"
          >
            {t('back', { name: organization.name })}
          </Link>
          <Heading level={1} size="page">
            {t('heading', { name: organization.name })}
          </Heading>
        </div>
        <OrganizationManage
          initial={organization}
          created={firstParam(await searchParams, 'created') === '1'}
        />
      </div>
    </SingleColumnLayout>
  );
}
