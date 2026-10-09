import { meControllerProfile, memberNetworkControllerRelationship } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { siteConfig } from '@/config/site';
import { LazyRelationshipActions, ProfileViewsSummary } from '@/features/network';
import { MemberProfile, personJsonLd } from '@/features/profiles';
import { Link } from '@/i18n/navigation';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';
import { resourceMetadata } from '@/lib/resources/metadata';
import { jsonLd } from '@/lib/seo/json-ld';
import { readProfile as read } from './read-profile';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/members/[handle]'>): Promise<Metadata> {
  const { locale, handle } = await params;
  const resource = await read(handle);
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.member(resource?.data.handle ?? handle),
    resource,
    resource?.data.displayName,
  );
  return resource?.data.headline ? { ...metadata, description: resource.data.headline } : metadata;
}

/**
 * Profile of a member (§10.1), at the address of its handle for visitors and members (ADR 0101):
 * the public page a member opened to everyone, or the member view, both as the api gives them; a
 * former handle redirects to the current one. A member reader gets the actions of the
 * relationship, the owner edits the page in place and sees who viewed it.
 */
export default async function Page({ params }: PageProps<'/[locale]/members/[handle]'>) {
  const { locale: raw, handle } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const resource = await read(handle);
  if (!resource) notFound();
  const profile = resource.data;
  if (profile.handle !== handle) permanentRedirect(`/${locale}${routes.member(profile.handle)}`);
  const member = await getCurrentMember();
  const owner = member?.profile.handle === profile.handle;
  configureServerApi();
  const [own, relationship] = await Promise.all([
    owner ? meControllerProfile({ cache: 'no-store' }) : null,
    member
      ? memberNetworkControllerRelationship(profile.handle, { cache: 'no-store' }).catch(() => null)
      : null,
  ]);
  const t = await getTranslations('web.profile.page');
  const address = new URL(`/${locale}${routes.member(profile.handle)}`, siteConfig.url).toString();

  const actions =
    resource.view === 'visitor' ? (
      <Button asChild>
        <Link href={withRedirect(routes.signIn, `/${locale}${routes.member(profile.handle)}`)}>
          {t('joinToConnect')}
        </Link>
      </Button>
    ) : relationship && !owner ? (
      <LazyRelationshipActions
        handle={profile.handle}
        name={profile.displayName}
        relationship={relationship}
        url={address}
      />
    ) : undefined;

  return (
    <SingleColumnLayout>
      <MemberProfile
        profile={profile}
        view={resource.view}
        locale={locale}
        own={own}
        relationship={relationship}
        actions={actions}
        aside={owner ? <ProfileViewsSummary /> : undefined}
      />
      {resource.view === 'visitor' ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(personJsonLd(profile, address)) }}
        />
      ) : null}
    </SingleColumnLayout>
  );
}
