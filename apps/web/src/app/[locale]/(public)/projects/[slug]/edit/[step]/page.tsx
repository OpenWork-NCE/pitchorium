import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { isWizardStep, ProjectEditor } from '@/features/projects';
import { asLocale } from '@/i18n/routing';
import { readEditable } from '../read-editable';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects/[slug]/edit/[step]'>): Promise<Metadata> {
  const { step } = await params;
  const t = await getTranslations('web.projects.editor');
  return {
    title: isWizardStep(step) ? t(`steps.${step}.title`) : t('creating'),
    robots: { index: false, follow: false },
  };
}

/**
 * A step of the assistant of a project (§11.1, ADR 0131), for its team only. The preview has its
 * own route (`edit/preview`): the components of the public page stay out of the other steps.
 */
export default async function Page({ params }: PageProps<'/[locale]/projects/[slug]/edit/[step]'>) {
  const { locale: raw, slug, step } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  if (!isWizardStep(step) || step === 'preview') notFound();
  const project = await readEditable(locale, slug, step);
  return (
    <SingleColumnLayout width="prose">
      <ScopedMessages scope="projectEditor">
        <ProjectEditor project={project} step={step} />
      </ScopedMessages>
    </SingleColumnLayout>
  );
}
