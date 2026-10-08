import { Construction } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EmptyState, Heading, Kicker } from '@/components/ui';
import { SingleColumnLayout } from './page-layouts';

/**
 * Page of a resource before its own content (it arrives with its PROMPT FRONT): its kind and its
 * name in the layout it will have, read with the view of the reader, and an honest empty state.
 */
export async function ResourcePlaceholder({ kind, name }: { kind: string; name: string }) {
  const t = await getTranslations('web.placeholder');
  return (
    <SingleColumnLayout>
      <div className="grid gap-6">
        <div className="grid gap-1">
          <Kicker>{kind}</Kicker>
          <Heading level={1} size="page">
            {name}
          </Heading>
        </div>
        <EmptyState icon={<Construction />} title={t('title')} description={t('body')} />
      </div>
    </SingleColumnLayout>
  );
}
