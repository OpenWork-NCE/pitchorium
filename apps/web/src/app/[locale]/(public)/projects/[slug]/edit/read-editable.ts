import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { routes } from '@/config/routes';
import type { WizardStep } from '@/features/projects';
import type { Locale } from '@pitchorium/contracts';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';
import { readProject } from '../read-project';

/**
 * The project of a step of the assistant (§11.1, ADR 0131), for its team only (404 otherwise),
 * read from the api so that a step resumes exactly where it was left. The preview and the
 * publication exist for a draft only.
 */
export async function readEditable(locale: Locale, slug: string, step: WizardStep) {
  const path = `/${locale}${routes.projectEdit(slug, step)}`;
  if (!(await getCurrentMember())) redirect(withRedirect(`/${locale}${routes.signIn}`, path));
  const resource = await readProject(slug);
  if (!resource?.data.management) notFound();
  const project = resource.data;
  if (project.slug !== slug)
    permanentRedirect(`/${locale}${routes.projectEdit(project.slug, step)}`);
  if (project.status !== 'draft' && (step === 'preview' || step === 'publish')) {
    redirect(`/${locale}${routes.project(project.slug)}`);
  }
  return project;
}
