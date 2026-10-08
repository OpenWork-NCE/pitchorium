import { Construction } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/ui';
import { routes } from '@/config/routes';
import { AdminPage } from './admin-page';

type Section = 'dashboard' | 'moderation' | 'members' | 'flags';

/** A page of the administration before its own (moderation, members, flags): its frame only. */
export async function AdminPlaceholder({ section }: { section: Section }) {
  const t = await getTranslations('web.admin');
  const placeholder = await getTranslations('web.placeholder');
  return (
    <AdminPage
      breadcrumbs={
        section === 'dashboard'
          ? [{ label: t('label') }]
          : [{ label: t('label'), href: routes.admin }, { label: t(`nav.${section}`) }]
      }
      title={t(`nav.${section}`)}
    >
      <EmptyState
        icon={<Construction />}
        title={placeholder('title')}
        description={placeholder('body')}
      />
    </AdminPage>
  );
}
