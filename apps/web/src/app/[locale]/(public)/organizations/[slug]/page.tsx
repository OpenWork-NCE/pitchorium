import { followsControllerState } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { siteConfig } from '@/config/site';
import { FollowButton } from '@/features/network';
import { OrganizationProfile, organizationJsonLd } from '@/features/organizations';
import { Link } from '@/i18n/navigation';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { withRedirect } from '@/lib/auth/redirect';
import { resourceMetadata } from '@/lib/resources/metadata';
import { jsonLd } from '@/lib/seo/json-ld';
import { readOrganization } from './read-organization';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/organizations/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const resource = await readOrganization(slug);
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.organization(resource?.data.slug ?? slug),
    resource,
    resource?.data.name,
  );
  return resource?.data.description
    ? { ...metadata, description: resource.data.description.slice(0, 160) }
    : metadata;
}

/**
 * Page of an organisation (§10.7), one address for visitors and members (ADR 0101): a former
 * slug redirects to the current one; a member follows it, a visitor is invited in.
 */
export default async function Page({ params }: PageProps<'/[locale]/organizations/[slug]'>) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const resource = await readOrganization(slug);
  if (!resource) notFound();
  const organization = resource.data;
  if (organization.slug !== slug) {
    permanentRedirect(`/${locale}${routes.organization(organization.slug)}`);
  }
  const t = await getTranslations('web.organizations.page');
  const path = `/${locale}${routes.organization(organization.slug)}`;
  configureServerApi();
  const follow =
    resource.view === 'member'
      ? await followsControllerState('organization', organization.id, { cache: 'no-store' }).catch(
          () => null,
        )
      : null;
  const actions =
    resource.view === 'visitor' ? (
      <Button asChild>
        <Link href={withRedirect(routes.signIn, path)}>{t('joinToFollow')}</Link>
      </Button>
    ) : follow ? (
      <FollowButton
        type="organization"
        targetKey={organization.id}
        name={organization.name}
        initial={follow}
      />
    ) : undefined;
  return (
    <SingleColumnLayout>
      <OrganizationProfile
        organization={organization}
        view={resource.view}
        locale={locale}
        actions={actions}
      />
      {resource.view === 'visitor' ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              organizationJsonLd(organization, new URL(path, siteConfig.url).toString()),
            ),
          }}
        />
      ) : null}
    </SingleColumnLayout>
  );
}
