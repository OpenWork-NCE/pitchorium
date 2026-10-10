import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import { routes } from '@/config/routes';
import { CreateProject } from '@/features/projects';
import { asLocale } from '@/i18n/routing';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.projects.editor.create');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Creation of a project (§11.1, ADR 0131): its first step, « Essentiel », for a member (an
 * entrepreneur facet is asked when it lacks); the draft then lives at its own address.
 */
export default async function Page({ params }: PageProps<'/[locale]/projects/new'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!(await getCurrentMember())) {
    redirect(withRedirect(`/${locale}${routes.signIn}`, `/${locale}${routes.createProject}`));
  }
  const t = await getTranslations('web.projects.editor.create');
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{t('description')}</Text>
        </div>
        <ScopedMessages scope="projectEditor">
          <CreateProject />
        </ScopedMessages>
      </div>
    </SingleColumnLayout>
  );
}
