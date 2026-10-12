import { adminControllerMembers } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import { Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { MemberResults, SearchField } from '@/features/admin';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.members');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The search of the members (`?q=`), audited by the api; each result opens its file. */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/admin/members'>) {
  setRequestLocale(asLocale((await params).locale));
  const q = (await searchParams)['q'];
  const query = typeof q === 'string' ? q.trim() : '';
  const t = await getTranslations('web.admin');
  configureServerApi();
  const page =
    query.length >= 2
      ? await consoleRead(adminControllerMembers({ q: query, limit: 25 }, { cache: 'no-store' }))
      : null;
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('members.title') }]}
      title={t('members.title')}
      description={t('members.description')}
      audited
    >
      <SearchField label={t('members.searchLabel')} placeholder={t('members.searchPlaceholder')} />
      {page ? (
        <MemberResults key={query} query={query} page={page} />
      ) : (
        <Text tone="muted">{t('members.prompt')}</Text>
      )}
    </AdminPage>
  );
}
