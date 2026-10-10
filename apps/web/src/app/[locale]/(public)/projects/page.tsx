import {
  methodologiesControllerPublished,
  profilesControllerReferenceData,
  projectsControllerPublicShowcase,
  projectsControllerShowcase,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import { routes } from '@/config/routes';
import {
  LazyProjectInvitations,
  ProjectShowcase,
  readShowcaseFilters,
  showcaseQuery,
} from '@/features/projects';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { countryOptions } from '@/lib/format/countries';
import { resourceMetadata } from '@/lib/resources/metadata';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.projects.showcase');
  const member = await getCurrentMember();
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.projects,
    { view: member ? 'member' : 'visitor', data: null },
    t('title'),
  );
  return { ...metadata, description: t('description') };
}

/**
 * Showcase of the projects (§10.6), public and indexable, the same address in the member space
 * (ADR 0101): the filters are in the address and each set of them is rendered by the server.
 */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/projects'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations('web.projects.showcase');
  const reference = await getTranslations('reference');
  const filters = readShowcaseFilters(await searchParams);
  configureServerApi();
  const member = await getCurrentMember();
  const signedIn = member !== null;
  const read = signedIn ? projectsControllerShowcase : projectsControllerPublicShowcase;
  const options = { cache: 'no-store' } as const;
  const [methodology, data] = await Promise.all([
    methodologiesControllerPublished(options).catch(() => null),
    profilesControllerReferenceData(options).catch(() => null),
  ]);
  const impactAvailable = methodology !== null;
  const [page, featured] = await Promise.all([
    read(showcaseQuery(filters, { impactAvailable }), options).catch(() => null),
    read({ featured: 'true', limit: 4 }, options).catch(() => null),
  ]);
  const countries = countryOptions(
    (data?.countries ?? []).filter((country) => country.eligibleForCompany).map((c) => c.code),
    locale,
  );
  const sectors = (data?.sectors ?? []).map(({ code }) => ({
    value: code,
    label: reference.has(`sectorsShort.${code}` as never)
      ? reference(`sectorsShort.${code}` as never)
      : reference(`sectors.${code}` as never),
  }));
  return (
    <SingleColumnLayout>
      <div className="grid gap-8">
        <header className="grid max-w-prose gap-2">
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{t('lede')}</Text>
        </header>
        {signedIn ? <LazyProjectInvitations /> : null}
        <ProjectShowcase
          filters={filters}
          featured={featured?.items ?? []}
          page={page}
          countries={countries}
          sectors={sectors}
          impactAvailable={impactAvailable}
          signedIn={signedIn}
        />
      </div>
    </SingleColumnLayout>
  );
}
