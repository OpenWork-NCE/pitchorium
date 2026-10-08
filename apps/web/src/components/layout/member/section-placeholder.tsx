import { Construction } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Card, EmptyState, Heading, Text } from '@/components/ui';
import { SingleColumnLayout, ThreeColumnLayout } from '../page-layouts';

type Section =
  'home' | 'network' | 'projects' | 'messages' | 'notifications' | 'profile' | 'settings';

/** Sections laid out on three columns on a wide screen (§6.1); the others on one. */
const THREE_COLUMNS: readonly Section[] = ['home', 'network', 'projects'];

/**
 * A section of the member space before its own page (PROMPT FRONT 2 and next): its title in the
 * layout it will have, and an honest empty state. No business content.
 */
export async function SectionPlaceholder({ section }: { section: Section }) {
  const t = await getTranslations('web.placeholder');
  const nav = await getTranslations('web.nav');
  const layout = await getTranslations('web.layout');
  const body = (
    <div className="grid gap-6">
      <Heading level={1} size="page">
        {nav(section)}
      </Heading>
      <EmptyState icon={<Construction />} title={t('title')} description={t('body')} />
    </div>
  );
  if (!THREE_COLUMNS.includes(section)) return <SingleColumnLayout>{body}</SingleColumnLayout>;
  return (
    <ThreeColumnLayout
      leftLabel={layout('left')}
      rightLabel={layout('right')}
      left={<SidePanel title={layout('left')} body={t('aside')} />}
      right={<SidePanel title={layout('right')} body={t('aside')} />}
    >
      {body}
    </ThreeColumnLayout>
  );
}

/** A side column before its content: its title on a card, so that the layout reads as it will. */
function SidePanel({ title, body }: { title: string; body: string }) {
  return (
    <Card padding="sm" className="grid gap-1">
      <Heading level={2} size="label">
        {title}
      </Heading>
      <Text size="sm" tone="muted">
        {body}
      </Text>
    </Card>
  );
}
