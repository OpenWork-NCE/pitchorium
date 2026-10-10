import type { Locale, Project } from '@pitchorium/contracts';
import { CheckCircle2, Circle } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Avatar, Badge, Card, Link, MarkdownContent, Notice, Text } from '@/components/ui';
import { routes } from '@/config/routes';
import { MemberHoverCard } from '@/features/profiles';
import { formatMoney } from '@/lib/format/money';
import { pluralOf } from '@/lib/i18n/plural-of';
import { SectionHeading } from './section-heading';

interface SectionProps {
  project: Project;
  locale: Locale;
  /** The public view, an editorial page: its titles are revealed (D4). */
  editorial: boolean;
}

/** « Histoire » (§11.2): the restricted Markdown of the api, under its h2. */
export async function StorySection({ project, editorial }: Omit<SectionProps, 'locale'>) {
  if (!project.description) return null;
  const t = await getTranslations('web.projects.page');
  return (
    <section aria-labelledby="story-title" className="grid gap-4">
      <SectionHeading id="story-title" editorial={editorial}>
        {t('story')}
      </SectionHeading>
      <MarkdownContent source={project.description} sectionLevel={2} />
      {project.impactArea ? (
        <Text size="sm" tone="muted">
          {t('impactArea', { area: project.impactArea })}
        </Text>
      ) : null}
    </section>
  );
}

/**
 * The tiers (§11.2, ADR 0038), cumulative, each with its threshold, the use of its funds and its
 * state: reached ones drawn in the colour of success, never a promise of success.
 */
export async function TiersSection({ project, locale, editorial }: SectionProps) {
  if (project.tiers.length === 0) return null;
  const t = await getTranslations('web.projects.tiers');
  const format = await getFormatter();
  return (
    <section aria-labelledby="tiers-title" className="grid gap-4">
      <SectionHeading id="tiers-title" editorial={editorial}>
        {t('title')}
      </SectionHeading>
      <ol className="grid gap-3">
        {project.tiers.map((tier) => (
          <li key={tier.id}>
            <Card padding="sm" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              {tier.unlocked ? (
                <CheckCircle2 aria-hidden className="mt-0.5 size-5 text-success" />
              ) : (
                <Circle aria-hidden className="mt-0.5 size-5 text-muted" />
              )}
              <div className="grid min-w-0 gap-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{t('tier', { position: tier.position })}</span>
                  <span className="font-numeric tabular-nums">
                    {formatMoney(tier.threshold, locale)}
                  </span>
                </p>
                <p className="text-sm text-pretty">{tier.description}</p>
                <p
                  className={
                    tier.unlocked ? 'text-xs font-medium text-success' : 'text-xs text-muted'
                  }
                >
                  {tier.unlocked
                    ? tier.unlockedAt
                      ? t('reachedOn', {
                          date: format.dateTime(new Date(tier.unlockedAt), { dateStyle: 'long' }),
                        })
                      : t('reached')
                    : t('upcoming')}
                </p>
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <Text size="sm" tone="muted">
        {t('notAPromise')}
      </Text>
    </section>
  );
}

/**
 * The rewards (§11.2, §11.3): minimum amount, instruments that give them, availability and units
 * left, estimated delivery. Love money has no material reward, and the section says so.
 */
export async function RewardsSection({ project, locale, editorial }: SectionProps) {
  const loveMoney = project.funding.instruments.includes('love_money');
  if (project.rewards.length === 0 && !loveMoney) return null;
  const t = await getTranslations('web.projects.rewards');
  const reference = await getTranslations('reference');
  const format = await getFormatter();
  return (
    <section aria-labelledby="rewards-title" className="grid gap-4">
      <SectionHeading id="rewards-title" editorial={editorial}>
        {t('title')}
      </SectionHeading>
      {project.rewards.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {project.rewards.map((reward) => (
            <li key={reward.id}>
              <Card padding="sm" className="grid h-full content-start gap-2">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold text-pretty">{reward.title}</span>
                  <span className="font-numeric text-sm tabular-nums">
                    {t('from', { amount: formatMoney(reward.minAmount, locale) })}
                  </span>
                </p>
                <p className="text-sm text-pretty whitespace-pre-line">{reward.description}</p>
                <div className="flex flex-wrap gap-2">
                  {reward.instruments.map((instrument) => (
                    <Badge key={instrument}>
                      {reference(`fundingInstruments.${instrument}` as never)}
                    </Badge>
                  ))}
                  {reward.soldOut ? (
                    <Badge tone="warning">{t('soldOut')}</Badge>
                  ) : reward.available !== null ? (
                    <Badge>
                      {t(`left.${pluralOf(locale, reward.available)}`, {
                        count: reward.available,
                        total: reward.quantity ?? reward.available,
                      })}
                    </Badge>
                  ) : (
                    <Badge>{t('unlimited')}</Badge>
                  )}
                </div>
                {reward.estimatedDelivery ? (
                  <p className="text-xs text-muted">
                    {t('delivery', {
                      date: format.dateTime(new Date(`${reward.estimatedDelivery}T00:00:00Z`), {
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      }),
                    })}
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
      {loveMoney ? (
        <Text size="sm" tone="muted">
          {t('loveMoney')}
        </Text>
      ) : null}
    </section>
  );
}

/** « Équipe » (§11.2): the members the api shows (consent of the public display, ADR 0040). */
export async function TeamSection({
  project,
  editorial,
  signedIn,
}: Omit<SectionProps, 'locale'> & { signedIn: boolean }) {
  if (project.team.length === 0) return null;
  const t = await getTranslations('web.projects.team');
  const reference = await getTranslations('reference');
  return (
    <section aria-labelledby="team-title" className="grid gap-4">
      <SectionHeading id="team-title" editorial={editorial}>
        {t('title')}
      </SectionHeading>
      <ul className="grid gap-3 sm:grid-cols-2">
        {project.team.map((member) => (
          <li key={member.member.handle} className="flex min-w-0 items-start gap-3">
            <Avatar
              name={member.member.displayName}
              src={member.member.avatarUrl}
              size="md"
              decorative
            />
            <div className="grid min-w-0 text-sm">
              <MemberHoverCard member={member.member} signedIn={signedIn} />
              <span className="text-muted">
                {member.function ?? reference(`projectTeamRoles.${member.role}`)}
              </span>
              {member.member.headline ? (
                <span className="line-clamp-2 text-xs text-muted">{member.member.headline}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The self-declared impact (§12) in full: the score, its level, the methodology and its version,
 * the detail by criterion, and the mention that it is not a certification.
 */
export async function ImpactSection({ project, editorial }: Omit<SectionProps, 'locale'>) {
  const assessment = project.impactAssessment;
  if (!assessment) return null;
  const t = await getTranslations('web.projects.impact');
  const reference = await getTranslations('reference');
  const label = (key: string) => (reference.has(key as never) ? reference(key as never) : key);
  return (
    <section aria-labelledby="impact-title" className="grid gap-4">
      <SectionHeading id="impact-title" editorial={editorial}>
        {t('title')}
      </SectionHeading>
      <p className="text-sm">
        {t('score', {
          score: assessment.score,
          level: reference(`impactLevels.${assessment.level}`),
        })}
      </p>
      <ul className="grid gap-3">
        {assessment.details.map((detail) => (
          <li key={detail.criterionKey} className="grid gap-1">
            <span className="flex flex-wrap justify-between gap-x-3 text-sm">
              <span className="font-medium">{label(detail.labelKey)}</span>
              <span className="text-muted">
                {label(detail.answerLabelKey)}
                <span aria-hidden> · </span>
                <span className="tabular-nums">
                  {t('value', { value: detail.value, max: detail.maxValue })}
                </span>
              </span>
            </span>
            <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-track">
              <span
                className="block h-full rounded-full bg-accent"
                style={{
                  width: `${detail.maxValue === 0 ? 0 : (detail.value / detail.maxValue) * 100}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      <Notice kind="selfDeclared" version={`v${assessment.methodology.version}`} />
      {assessment.methodology.demo ? (
        <Text size="sm" tone="muted">
          {reference('impactMentions.demo')}
        </Text>
      ) : null}
      <p className="text-sm">
        <Link href={routes.impactMethodology} variant="standalone">
          {t('methodology', { version: assessment.methodology.version })}
        </Link>
      </p>
    </section>
  );
}
