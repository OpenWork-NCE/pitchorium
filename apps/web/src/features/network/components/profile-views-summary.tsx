import {
  type ProfileViewsSummaryDtoOutput,
  profileViewsControllerSummary,
} from '@pitchorium/api-client';
import { getTranslations } from 'next-intl/server';
import { Alert, Card, Count, Heading, Link } from '@/components/ui';
import { routes } from '@/config/routes';

async function Periods({ summary }: { summary: ProfileViewsSummaryDtoOutput }) {
  const t = await getTranslations('web.network.views');
  const periods = [
    { key: 'last7Days', value: summary.last7Days },
    { key: 'last30Days', value: summary.last30Days },
    { key: 'last90Days', value: summary.last90Days },
  ] as const;
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      {periods.map(({ key, value }) => (
        <div key={key} className="grid gap-0.5 rounded-md bg-surface-sunken px-2 py-3">
          <dd className="order-first font-display text-2xl font-extrabold tabular-nums">
            <Count value={value} />
          </dd>
          <dt className="text-xs text-muted">{t(`periods.${key}`)}</dt>
        </div>
      ))}
    </dl>
  );
}

/**
 * « Qui a consulté votre profil » for its owner (§10.2): the visits of the last 7, 30 and 90 days,
 * each count rising once in view, and the way to the list. Nothing when the api cannot say.
 */
export async function ProfileViewsSummary() {
  const t = await getTranslations('web.network.views');
  const summary = await profileViewsControllerSummary({ cache: 'no-store' }).catch(() => null);
  if (!summary) return null;
  return (
    <Card padding="sm" className="grid gap-3" data-profile-views="">
      <Heading level={2} size="label">
        {t('title')}
      </Heading>
      <Periods summary={summary} />
      <Link href={routes.profileViews} variant="standalone" className="justify-self-start text-sm">
        {t('see')}
      </Link>
    </Card>
  );
}

/**
 * The head of the page of the visits: the counts by period, how long visits are kept, and a
 * reminder of the private-visit setting of the member with the way to change it.
 */
export async function ProfileVisitsIntro({ privateVisits }: { privateVisits: boolean }) {
  const t = await getTranslations('web.network.visits');
  const summary = await profileViewsControllerSummary({ cache: 'no-store' });
  return (
    <div className="grid gap-4">
      <Periods summary={summary} />
      <p className="text-sm text-muted">{t('retention', { days: summary.retentionDays })}</p>
      <Alert
        tone="info"
        action={
          <Link href={routes.settingsPrivacy} variant="standalone" className="text-sm">
            {t('change')}
          </Link>
        }
      >
        {t(privateVisits ? 'privateOn' : 'privateOff')}
      </Alert>
    </div>
  );
}
