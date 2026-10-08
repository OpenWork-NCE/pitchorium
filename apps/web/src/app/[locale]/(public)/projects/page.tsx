import {
  projectsControllerPublicShowcase,
  projectsControllerShowcase,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cache } from 'react';
import { ResourcePlaceholder } from '@/components/layout/resource-placeholder';
import { routes } from '@/config/routes';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { resourceMetadata } from '@/lib/resources/metadata';
import { readResource } from '@/lib/resources/view';

/** The first page of the showcase as the reader may see it, read once per request. */
const read = cache(async () => {
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => projectsControllerShowcase({ limit: 20 }, { cache: 'no-store' }),
    forVisitor: () => projectsControllerPublicShowcase({ limit: 20 }, { cache: 'no-store' }),
  });
});

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.resources');
  return resourceMetadata(asLocale(locale), routes.projects, await read(), t('showcase'));
}

/**
 * Showcase of the projects (§10.6), public and indexable, the same address in the member space
 * (ADR 0101). Its grid and its filters arrive with the projects (PROMPT FRONT 5).
 */
export default async function Page({ params }: PageProps<'/[locale]/projects'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web.resources');
  await read();
  return <ResourcePlaceholder kind={t('project')} name={t('showcase')} />;
}
