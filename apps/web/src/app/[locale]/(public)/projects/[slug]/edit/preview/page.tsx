import { projectsControllerPreview } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { routes } from '@/config/routes';
import { siteConfig } from '@/config/site';
import { ProjectEditor, ProjectPage } from '@/features/projects';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { readEditable } from '../read-editable';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.projects.editor');
  return { title: t('steps.preview.title'), robots: { index: false, follow: false } };
}

/**
 * Step 9 of the assistant, « Aperçu » (§11.1, ADR 0131): the public page exactly as a visitor will
 * read it, rendered by the server from the preview of the api, for the team only.
 */
export default async function Page({
  params,
}: PageProps<'/[locale]/projects/[slug]/edit/preview'>) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const project = await readEditable(locale, slug, 'preview');
  configureServerApi();
  const shown = await projectsControllerPreview(project.id, { cache: 'no-store' });
  const pagePath = `/${locale}${routes.project(project.slug)}`;
  return (
    <SingleColumnLayout width="page">
      <ScopedMessages scope="projectEditor">
        <ProjectEditor
          project={project}
          step="preview"
          preview={
            <ProjectPage
              project={shown}
              locale={locale}
              view="preview"
              url={new URL(pagePath, siteConfig.url).toString()}
              path={pagePath}
              follow={null}
              parity={null}
            />
          }
        />
      </ScopedMessages>
    </SingleColumnLayout>
  );
}
