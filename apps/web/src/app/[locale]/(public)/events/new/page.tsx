import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { LazyEventForm } from '@/features/events';
import { asLocale } from '@/i18n/routing';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.events.form');
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

/**
 * Creation of an event (§14, ADR 0069), by a member, in their name or that of an organisation
 * they own or administer: a draft, published from its page. `new` is a reserved slug.
 */
export default async function Page({ params }: PageProps<'/[locale]/events/new'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!(await getCurrentMember())) {
    redirect(withRedirect(`/${locale}${routes.signIn}`, `/${locale}${routes.createEvent}`));
  }
  const t = await getTranslations('web.events.form');
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Heading level={1} size="page">
            {t('createTitle')}
          </Heading>
          <Text tone="muted">{t('createLede')}</Text>
        </div>
        <LazyEventForm event={null} />
      </div>
    </SingleColumnLayout>
  );
}
