import { followsControllerState } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Link } from '@/components/ui';
import { routes } from '@/config/routes';
import {
  LazyCollectionBanner,
  LazyProjectContributions,
  LazyProjectOffline,
  LazyProjectSupporters,
} from '@/features/payments';
import { ProjectManage } from '@/features/projects';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';
import { readProject } from '../read-project';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.projects.manage');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Management of a project by its team (§11.3): absent for any other reader (ADR 0101); the api
 * decides each action by the role in the team.
 */
export default async function Page({ params }: PageProps<'/[locale]/projects/[slug]/manage'>) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  if (!(await getCurrentMember())) {
    redirect(withRedirect(`/${locale}${routes.signIn}`, `/${locale}${routes.projectManage(slug)}`));
  }
  const resource = await readProject(slug);
  if (!resource?.data.management) notFound();
  const project = resource.data;
  if (project.slug !== slug) permanentRedirect(`/${locale}${routes.projectManage(project.slug)}`);
  configureServerApi();
  const follow =
    project.status === 'draft'
      ? null
      : await followsControllerState('project', project.id, { cache: 'no-store' }).catch(
          () => null,
        );
  const t = await getTranslations('web.projects.manage');
  const member = await getCurrentMember();
  // The parts of the payments (ADR 0136): a published project only.
  const payments =
    project.status === 'draft'
      ? null
      : {
          banner: (
            <LazyCollectionBanner
              projectId={project.id}
              holder={project.owner?.handle === member?.profile.handle}
            />
          ),
          contributions: <LazyProjectContributions projectId={project.id} slug={project.slug} />,
          offline: <LazyProjectOffline projectId={project.id} title={project.title} />,
          supporters: <LazyProjectSupporters projectId={project.id} />,
        };
  return (
    <SingleColumnLayout>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Link href={routes.project(project.slug)} variant="standalone" className="text-sm">
            {t('back', { title: project.title })}
          </Link>
          <Heading level={1} size="page">
            {t('heading', { title: project.title })}
          </Heading>
        </div>
        <ScopedMessages scope="projectEditor">
          <ProjectManage project={project} follow={follow} payments={payments} />
        </ScopedMessages>
      </div>
    </SingleColumnLayout>
  );
}
