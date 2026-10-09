import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Link } from '@/components/ui';
import { routes } from '@/config/routes';
import { MemberLists } from '@/features/network';
import { asLocale } from '@/i18n/routing';
import { getCurrentMember } from '@/lib/auth/session';
import { readProfile } from '../read-profile';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/members/[handle]/network'>): Promise<Metadata> {
  const { handle } = await params;
  const [resource, t] = await Promise.all([
    readProfile(handle),
    getTranslations('web.network.member'),
  ]);
  return {
    ...(resource ? { title: t('title', { name: resource.data.displayName }) } : {}),
    robots: { index: false, follow: true },
  };
}

/**
 * Connections, followers and follows of a member (§10.2), as their privacy allows it: the api
 * answers, a hidden list says so. Absent for the reader when the profile is (ADR 0101).
 */
export default async function Page({ params }: PageProps<'/[locale]/members/[handle]/network'>) {
  const { locale: raw, handle } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const resource = await readProfile(handle);
  if (!resource) notFound();
  const profile = resource.data;
  if (profile.handle !== handle) {
    permanentRedirect(`/${locale}${routes.memberNetwork(profile.handle)}`);
  }
  const member = await getCurrentMember();
  const t = await getTranslations('web.network.member');
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Link href={routes.member(profile.handle)} variant="standalone" className="text-sm">
            {t('back', { name: profile.displayName })}
          </Link>
          <Heading level={1} size="page">
            {t('title', { name: profile.displayName })}
          </Heading>
        </div>
        <MemberLists
          handle={profile.handle}
          name={profile.displayName}
          self={member?.profile.handle === profile.handle}
          signedIn={member !== null}
        />
      </div>
    </SingleColumnLayout>
  );
}
