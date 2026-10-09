import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading } from '@/components/ui';
import { SettingsNav } from '@/features/identity';

/** Settings of the account: one address per section, the navigation beside (above on a phone). */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('web.settings');
  return (
    <SingleColumnLayout>
      <div className="grid gap-6">
        <Heading level={1} size="page">
          {t('title')}
        </Heading>
        <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
          <SettingsNav />
          <div>{children}</div>
        </div>
      </div>
    </SingleColumnLayout>
  );
}
