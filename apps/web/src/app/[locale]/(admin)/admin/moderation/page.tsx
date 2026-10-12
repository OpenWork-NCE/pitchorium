import { moderationControllerModerators, moderationControllerQueue } from '@pitchorium/api-client';
import type { ModerationQueueQuery } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { UrlFilters } from '@/features/admin';
import { ModerationQueue } from '@/features/trust';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.moderation');
  return { title: t('title'), robots: { index: false, follow: false } };
}

const TARGETS = [
  'profile',
  'organization',
  'post',
  'comment',
  'project',
  'project_update',
  'event',
  'mission',
  'message',
  'media',
] as const;
const REASONS = [
  'spam',
  'harassment',
  'fraud',
  'illegal_content',
  'misleading_information',
  'intellectual_property',
  'other',
] as const;
/** The age filters of the queue: a case opened before this many hours. */
const AGES = { day: 24, week: 24 * 7, month: 24 * 30 } as const;

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;

/** The moderation queue (§13), filtered by status, assignment, target, reason and age. */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/admin/moderation'>) {
  setRequestLocale(asLocale((await params).locale));
  const search = await searchParams;
  const t = await getTranslations('web.admin');
  const reference = await getTranslations('reference');
  const age = pick(search['age'], Object.keys(AGES) as (keyof typeof AGES)[]);
  const query: Omit<ModerationQueueQuery, 'cursor' | 'limit'> = {
    status: pick(search['status'], ['open', 'resolved'] as const) ?? 'open',
    assigned: pick(search['assigned'], ['any', 'me', 'unassigned'] as const) ?? 'any',
    ...(pick(search['target'], TARGETS) ? { targetType: pick(search['target'], TARGETS)! } : {}),
    ...(pick(search['reason'], REASONS) ? { reason: pick(search['reason'], REASONS)! } : {}),
    ...(age
      ? { openedBefore: new Date(new Date().getTime() - AGES[age] * 3_600_000).toISOString() }
      : {}),
  };
  configureServerApi();
  const [page, moderators] = await Promise.all([
    consoleRead(moderationControllerQueue({ ...query, limit: 25 }, { cache: 'no-store' })),
    moderationControllerModerators({ cache: 'no-store' }).then(
      (list) => list.items,
      () => [],
    ),
  ]);
  const f = (key: string) => t(`moderation.filters.${key}` as never);
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.moderation') }]}
      title={t('moderation.title')}
      description={t('moderation.description')}
      audited
    >
      <UrlFilters
        filters={[
          {
            name: 'status',
            label: f('status'),
            control: 'buttons',
            defaultValue: 'open',
            options: [
              { value: 'open', label: f('open') },
              { value: 'resolved', label: f('resolved') },
            ],
          },
          {
            name: 'assigned',
            label: f('assigned'),
            control: 'buttons',
            defaultValue: 'any',
            options: [
              { value: 'any', label: f('any') },
              { value: 'me', label: f('me') },
              { value: 'unassigned', label: f('nobody') },
            ],
          },
          {
            name: 'target',
            label: f('target'),
            options: TARGETS.map((value) => ({
              value,
              label: reference(`reportTargetTypes.${value}`),
            })),
          },
          {
            name: 'reason',
            label: f('reason'),
            options: REASONS.map((value) => ({
              value,
              label: reference(`reportReasons.${value}`),
            })),
          },
          {
            name: 'age',
            label: f('age'),
            options: (Object.keys(AGES) as (keyof typeof AGES)[]).map((value) => ({
              value,
              label: f(value),
            })),
          },
        ]}
      >
        <ModerationQueue
          key={JSON.stringify(query)}
          page={page}
          query={query}
          moderators={moderators}
        />
      </UrlFilters>
    </AdminPage>
  );
}
