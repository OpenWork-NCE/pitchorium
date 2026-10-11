import { missionsControllerById, missionsControllerForPublic } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { cache } from 'react';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import * as routes from '@/config/paths';
import { MissionPage } from '@/features/missions';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { resourceMetadata } from '@/lib/resources/metadata';
import { readResource } from '@/lib/resources/view';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The mission as the reader may see it, read once per request. */
const readMission = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => missionsControllerById(id, { cache: 'no-store' }),
    forVisitor: () => missionsControllerForPublic(id, { cache: 'no-store' }),
  });
});

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/missions/[id]'>): Promise<Metadata> {
  const { locale, id } = await params;
  const resource = await readMission(id);
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.mission(id),
    resource,
    resource?.data.title,
  );
  // A volunteer mission, never a job offer: no `JobPosting` data (ADR 0154).
  return resource
    ? { ...metadata, description: resource.data.description.slice(0, 160) }
    : metadata;
}

/**
 * Page of a mission (§6.3, ADR 0101): public when its author chose it, a member view otherwise;
 * 404 for a reader who cannot see it.
 */
export default async function Page({ params }: PageProps<'/[locale]/missions/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(asLocale(locale));
  const resource = await readMission(id);
  if (!resource) notFound();
  return (
    <SingleColumnLayout>
      <MissionPage mission={resource.data} view={resource.view} />
    </SingleColumnLayout>
  );
}
