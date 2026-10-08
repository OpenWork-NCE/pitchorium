import {
  organizationsControllerForMember,
  organizationsControllerForPublic,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cache } from 'react';
import { ResourcePlaceholder } from '@/components/layout/resource-placeholder';
import { routes } from '@/config/routes';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { resourceMetadata } from '@/lib/resources/metadata';
import { readResource } from '@/lib/resources/view';

/** The organisation as the reader may see it, read once per request. */
const read = cache(async (slug: string) => {
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => organizationsControllerForMember(slug, { cache: 'no-store' }),
    forVisitor: () => organizationsControllerForPublic(slug, { cache: 'no-store' }),
  });
});

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/organizations/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const resource = await read(slug);
  return resourceMetadata(
    asLocale(locale),
    routes.organization(slug),
    resource,
    resource?.data.name,
  );
}

/**
 * Page of an organisation (§10.7), one address for visitors and members (ADR 0101). Its content
 * arrives with the organisations.
 */
export default async function Page({ params }: PageProps<'/[locale]/organizations/[slug]'>) {
  const { locale, slug } = await params;
  setRequestLocale(asLocale(locale));
  const resource = await read(slug);
  if (!resource) notFound();
  const t = await getTranslations('web.resources');
  return <ResourcePlaceholder kind={t('organization')} name={resource.data.name} />;
}
