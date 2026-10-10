import { notFound, redirect } from 'next/navigation';
import { routes } from '@/config/routes';
import { resumeStep } from '@/features/projects';
import { asLocale } from '@/i18n/routing';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';
import { readProject } from '../read-project';

/** A draft resumes at its first step still to complete (ADR 0131), a published project at the start. */
export default async function Page({ params }: PageProps<'/[locale]/projects/[slug]/edit'>) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  if (!(await getCurrentMember())) {
    redirect(withRedirect(`/${locale}${routes.signIn}`, `/${locale}${routes.project(slug)}`));
  }
  const resource = await readProject(slug);
  if (!resource?.data.management) notFound();
  const project = resource.data;
  redirect(
    `/${locale}${routes.projectEdit(project.slug, project.status === 'draft' ? resumeStep(project) : 'essentials')}`,
  );
}
