import type { FollowState, Locale, Project } from '@pitchorium/contracts';
import { getTranslations } from 'next-intl/server';
import { Alert, Button, ImpactBadge } from '@/components/ui';
import { routes } from '@/config/routes';
import { ActivitySection, ImageGallery } from '@/features/content';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { pluralOf } from '@/lib/i18n/plural-of';
import { fundingState } from '../../lib/funding-state';
import { resumeStep } from '../../lib/wizard-steps';
import type { FixedParity } from '../../lib/indicative-equivalent';
import { DocumentsSection } from './documents-section';
import { FundingPanel } from './funding-panel';
import { LazyMemberActions } from './lazy-member-actions';
import { MobileActionBar } from './mobile-action-bar';
import { ProjectHero } from './project-hero';
import {
  ImpactSection,
  RewardsSection,
  StorySection,
  TeamSection,
  TiersSection,
} from './project-sections';
import { SectionHeading } from './section-heading';
import { ShareActions } from './share-actions';
import { UpdatesSection } from './updates-section';
import { VideoFacade } from './video-facade';

export interface ProjectPageProps {
  project: Project;
  locale: Locale;
  /**
   * `visitor`: the public view, indexable, an editorial page; `member`: the view of a signed-in
   * member; `preview`: the page exactly as a visitor will see it, for the team of a draft.
   */
  view: 'visitor' | 'member' | 'preview';
  /** Absolute address of the page, for sharing. */
  url: string;
  /** Path of the page, where a visitor comes back after signing in. */
  path: string;
  /** The state of the reader's follow, for a member. */
  follow: FollowState | null;
  /** The franc of the reader at its fixed parity (ADR 0130), null otherwise. */
  parity: FixedParity | null;
}

/**
 * The page of a project (§11.2), the heart of the web app: its main block, then the editorial
 * content on the left and, on a computer, the funding and the actions in a sticky column on the
 * right (`position: sticky`, never a pin); on a phone, the funding first and a contextual action
 * bar at the bottom of the screen (ADR 0132). The public view is an editorial page (D4).
 */
export async function ProjectPage({
  project,
  locale,
  view,
  url,
  path,
  follow,
  parity,
}: ProjectPageProps) {
  const t = await getTranslations('web.projects.page');
  const funding = await getTranslations('web.projects.funding');
  const reference = await getTranslations('reference');
  const signedIn = view === 'member';
  const editorial = view === 'visitor';
  const team = project.management;
  const draft = project.status === 'draft';
  const state = fundingState(project.status, project.funding, {
    frozen: project.fundingFrozen,
    durationDays: team?.durationDays ?? null,
  });
  const impact = project.impact ? (
    <ImpactBadge
      level={project.impact.level}
      levelLabel={reference(`impactLevels.${project.impact.level}`)}
      score={project.impact.score}
      mention={reference('impactMentions.selfDeclared', {
        version: `v${project.impact.methodologyVersion}`,
      })}
      criteria={(project.impactAssessment?.details ?? []).map((detail) => ({
        label: reference.has(detail.labelKey as never)
          ? reference(detail.labelKey as never)
          : detail.criterionKey,
        score: detail.value,
        max: detail.maxValue,
      }))}
      methodology={{ href: routes.impactMethodology, label: t('methodology') }}
    />
  ) : null;
  const memberActions =
    signedIn && follow && !draft ? (
      <LazyMemberActions project={{ id: project.id, title: project.title }} follow={follow} />
    ) : null;
  const visitorAction =
    view === 'visitor' ? (
      <Button asChild>
        <Link href={withRedirect(routes.signIn, path)}>{t('joinToFollow')}</Link>
      </Button>
    ) : null;
  const percent = project.funding.progressPercent;
  const summary =
    state.time.kind === 'daysLeft'
      ? funding('barDays', {
          percent,
          days: funding(`daysLeft.${pluralOf(locale, state.time.days)}`, {
            count: state.time.days,
          }),
        })
      : state.time.kind === 'ended'
        ? funding('barEnded', {
            percent,
            outcome: funding(state.outcome === 'closed_funded' ? 'endedFunded' : 'endedClosed'),
          })
        : funding('barPercent', { percent });
  const cover = project.gallery[0]?.url ?? null;

  return (
    <div className={draft ? 'grid gap-8' : 'grid gap-8 pb-24 lg:pb-0'}>
      {view === 'preview' ? (
        <Alert tone="info" title={t('previewTitle')}>
          {t('previewBody')}
        </Alert>
      ) : draft ? (
        <Alert tone="info" title={t('draftTitle')}>
          {t('draftBody')}
        </Alert>
      ) : null}
      {team && view !== 'preview' ? (
        <nav aria-label={t('teamNav')} className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={routes.projectManage(project.slug)}>{t('manage')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={routes.projectEdit(project.slug, draft ? resumeStep(project) : 'essentials')}
            >
              {t('edit')}
            </Link>
          </Button>
        </nav>
      ) : null}
      <ProjectHero
        project={project}
        locale={locale}
        signedIn={signedIn}
        editorial={editorial}
        impact={impact}
      />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <aside
          aria-label={t('fundingColumn')}
          className="order-first grid gap-5 rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-[calc(var(--header-height,4.5rem)+1.5rem)] lg:order-last"
        >
          <FundingPanel
            project={project}
            locale={locale}
            parity={parity}
            actions={
              draft ? null : (
                <div className="grid gap-4">
                  {/* On a phone, the action bar holds them. */}
                  <div className="hidden lg:grid">{memberActions ?? visitorAction}</div>
                  <ShareActions url={url} title={project.title} />
                </div>
              )
            }
          />
        </aside>
        <div className="grid min-w-0 gap-10">
          <StorySection project={project} editorial={editorial} />
          {project.video ? (
            <section aria-labelledby="video-title" className="grid gap-4">
              <SectionHeading id="video-title" editorial={editorial}>
                {t('video')}
              </SectionHeading>
              <VideoFacade video={project.video} title={project.title} poster={cover} />
            </section>
          ) : null}
          {project.gallery.length > 0 ? (
            <section aria-labelledby="gallery-title" className="grid gap-4">
              <SectionHeading id="gallery-title" editorial={editorial}>
                {t('gallery')}
              </SectionHeading>
              <ImageGallery images={project.gallery} postId={project.id} />
            </section>
          ) : null}
          <TiersSection project={project} locale={locale} editorial={editorial} />
          <RewardsSection project={project} locale={locale} editorial={editorial} />
          {signedIn ? <DocumentsSection project={project} /> : null}
          <UpdatesSection project={project} editorial={editorial} />
          <TeamSection project={project} editorial={editorial} signedIn={signedIn} />
          {draft ? null : (
            <ActivitySection
              author={{ kind: 'project', projectId: project.id }}
              signedIn={signedIn}
              title={t('posts')}
              hideWhenEmpty
            />
          )}
          <ImpactSection project={project} editorial={editorial} />
        </div>
      </div>
      {draft || view === 'preview' ? null : (
        <MobileActionBar summary={summary} label={t('actionBar')}>
          {memberActions ? (
            <LazyMemberActions
              project={{ id: project.id, title: project.title }}
              follow={follow!}
              layout="bar"
            />
          ) : (
            visitorAction
          )}
        </MobileActionBar>
      )}
    </div>
  );
}
