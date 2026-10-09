import type { ProjectCard as ProjectCardData, ProjectTier } from '@pitchorium/contracts';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, Card, FundingProgress, Heading, ImpactBadge, Text } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

interface ProjectCardProps {
  project: ProjectCardData;
  /**
   * `compact` (side columns): visual, title, amount and progress, days left, impact and the link;
   * `full` (grids, feed): with the summary, the categories and the milestones.
   */
  variant?: 'compact' | 'full';
  /** Milestones of the campaign (`full`), read with the project. */
  tiers?: readonly ProjectTier[];
  /** Level of the title in the outline of the page. */
  headingLevel?: 2 | 3;
  className?: string;
}

/**
 * Card of a project (§11.2): what it does, where its funding stands, its self-declared impact and
 * the way to its page, « Voir le projet » (its accessible name ends with the title, so that a list
 * of cards has distinct links).
 */
export function ProjectCard({
  project,
  variant = 'full',
  tiers = [],
  headingLevel = 3,
  className,
}: ProjectCardProps) {
  const t = useTranslations('web.projects.card');
  const reference = useTranslations('reference');
  const locale = useLocale();
  const compact = variant === 'compact';
  const { goal } = project.funding;
  // Codes of the reference data, labelled by the `reference` namespace.
  const sector = project.sectorCode
    ? (`sectors.${project.sectorCode}` as Parameters<typeof reference>[0])
    : null;
  // Short label on the card (« Énergie »), the full one in the tooltip and for screen readers.
  const sectorShort = project.sectorCode
    ? (`sectorsShort.${project.sectorCode}` as Parameters<typeof reference>[0])
    : null;
  const country = project.countryCodes[0];
  const countryName = country
    ? new Intl.DisplayNames(locale, { type: 'region' }).of(country)
    : undefined;

  return (
    <Card padding="none" className={cn('grid min-w-0 overflow-hidden', className)}>
      <div
        className={cn(
          'relative bg-cover-placeholder',
          compact ? 'aspect-[3/1]' : 'aspect-[3/1] sm:aspect-[4/1]',
        )}
      >
        {/* The elevation pattern, brightened on the deep violet of the dark theme to stay legible. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center dark:brightness-[2.6]"
        />
        {project.coverImageUrl ? (
          <Image
            src={project.coverImageUrl}
            alt=""
            fill
            sizes={compact ? '320px' : '(min-width: 1024px) 640px, 100vw'}
            className="object-cover"
          />
        ) : null}
      </div>
      <div className={cn('grid min-w-0 gap-4', compact ? 'p-4' : 'p-5')}>
        {compact ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{reference(`projectStatuses.${project.status}`)}</Badge>
            {sector && sectorShort && reference.has(sector) ? (
              <Badge title={reference(sector)}>
                <span aria-hidden>
                  {reference.has(sectorShort) ? reference(sectorShort) : reference(sector)}
                </span>
                <span className="sr-only">{reference(sector)}</span>
              </Badge>
            ) : null}
            {countryName ? <Badge>{countryName}</Badge> : null}
          </div>
        )}
        <div className="grid gap-1">
          <Heading
            level={headingLevel}
            size="card"
            className={cn('text-pretty', compact && 'line-clamp-2 text-base')}
          >
            {project.title}
          </Heading>
          {compact || !project.summary ? null : (
            <Text size="sm" tone="muted" className="line-clamp-3">
              {project.summary}
            </Text>
          )}
        </div>
        {goal ? (
          <FundingProgress
            size={compact ? 'compact' : 'full'}
            label={t('funding', { title: project.title })}
            raised={project.funding.collected}
            goal={goal}
            daysLeft={project.funding.daysLeft}
            milestones={tiers.map((tier) => ({
              amountMinor: tier.threshold.amountMinor,
              label: tier.description,
            }))}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {project.impact ? (
            <ImpactBadge
              level={project.impact.level}
              levelLabel={reference(`impactLevels.${project.impact.level}`)}
              score={project.impact.score}
              mention={reference('impactMentions.selfDeclared', {
                version: `v${project.impact.methodologyVersion}`,
              })}
              criteria={[]}
            />
          ) : (
            <span />
          )}
          <Button asChild variant="secondary" size="sm">
            <Link href={routes.project(project.slug)}>
              {t('view')}
              <span className="sr-only"> {project.title}</span>
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
