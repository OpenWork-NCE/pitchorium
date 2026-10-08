import { profilesControllerForMember, profilesControllerForPublic } from '@pitchorium/api-client';
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

/** The profile of a member as the reader may see it, read once per request. */
const read = cache(async (handle: string) => {
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => profilesControllerForMember(handle, { cache: 'no-store' }),
    forVisitor: () => profilesControllerForPublic(handle, { cache: 'no-store' }),
  });
});

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/members/[handle]'>): Promise<Metadata> {
  const { locale, handle } = await params;
  const resource = await read(handle);
  return resourceMetadata(
    asLocale(locale),
    routes.member(handle),
    resource,
    resource?.data.displayName,
  );
}

/**
 * Profile of a member (§10.1), at the address of its handle for visitors and members: the
 * public page a member opened to everyone, or the member view of a member (ADR 0101). Its
 * content arrives with the profiles (PROMPT FRONT 3).
 */
export default async function Page({ params }: PageProps<'/[locale]/members/[handle]'>) {
  const { locale, handle } = await params;
  setRequestLocale(asLocale(locale));
  const resource = await read(handle);
  if (!resource) notFound();
  const t = await getTranslations('web.resources');
  return <ResourcePlaceholder kind={t('member')} name={resource.data.displayName} />;
}
