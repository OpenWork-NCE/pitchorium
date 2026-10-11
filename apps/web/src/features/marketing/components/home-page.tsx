import type { ProjectCard as ProjectCardData } from '@pitchorium/contracts';
import { ArrowRight, Compass, HandHeart, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Container } from '@/components/layout/container';
import { SplitHeading } from '@/components/motion/split-heading';
import { Button, Card, Heading, Kicker, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { ProjectCard } from '@/features/projects';
import { Link } from '@/i18n/navigation';
import { EditorialHeader } from './editorial-header';

const USES = [
  { key: 'connect', icon: Users },
  { key: 'discover', icon: Compass },
  { key: 'support', icon: HandHeart },
] as const;
const STEPS = ['first', 'second', 'third'] as const;
const PRINCIPLES = ['money', 'impact', 'languages', 'public'] as const;

/** Section of an editorial page: its kicker, its title revealed in lines (H13), its content. */
function Section({
  id,
  kicker,
  title,
  children,
  className,
}: {
  id: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={className ?? 'py-16 md:py-24'}>
      <Container>
        <Kicker>{kicker}</Kicker>
        <SplitHeading
          id={id}
          className="mt-3 max-w-3xl font-display text-2xl font-extrabold text-balance md:text-4xl"
        >
          {title}
        </SplitHeading>
        {children}
      </Container>
    </section>
  );
}

/**
 * Editorial home page (§3 to §5, ADR 0156): the promise, the three uses, the two audiences and
 * their journeys, the principles of trust, real projects read from the api, and the call to join.
 * Every text comes from the specification; no figure nor testimony is shown.
 */
export function HomePage({ projects }: { projects: readonly ProjectCardData[] }) {
  const t = useTranslations('web.marketing.home');
  return (
    <>
      <EditorialHeader kicker={t('kicker')} title={t('title')} lede={t('lede')}>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={routes.signUp}>{t('join')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={routes.howItWorks}>{t('howItWorks')}</Link>
          </Button>
        </div>
      </EditorialHeader>

      <Section id="uses" kicker={t('usesKicker')} title={t('usesTitle')}>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {USES.map(({ key, icon: Icon }) => (
            <li key={key}>
              <Card className="h-full">
                <Icon aria-hidden className="size-6 text-accent" strokeWidth={1.75} />
                <Heading level={3} size="card" className="mt-4">
                  {t(`uses.${key}.title`)}
                </Heading>
                <Text tone="muted" className="mt-2">
                  {t(`uses.${key}.body`)}
                </Text>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="audiences"
        kicker={t('audiencesKicker')}
        title={t('audiencesTitle')}
        className="border-y border-border bg-surface py-16 md:py-24"
      >
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          {(['entrepreneur', 'contributor'] as const).map((audience) => (
            <div key={audience} className="grid content-start gap-4">
              <Heading level={3} size="card">
                {t(`${audience}.title`)}
              </Heading>
              <Text tone="muted">{t(`${audience}.body`)}</Text>
              <ol className="grid gap-3">
                {STEPS.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle font-numeric text-sm font-semibold text-on-accent-subtle tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <span>{t(`${audience}.steps.${step}`)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      <Section id="principles" kicker={t('principlesKicker')} title={t('principlesTitle')}>
        <dl className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <div key={principle} className="border-t border-border pt-4">
              <dt className="text-lg font-semibold">{t(`principles.${principle}.title`)}</dt>
              <dd className="mt-2 text-muted">{t(`principles.${principle}.body`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {projects.length > 0 ? (
        <Section
          id="projects"
          kicker={t('projectsKicker')}
          title={t('projectsTitle')}
          className="border-t border-border py-16 md:py-24"
        >
          <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-home-projects="">
            {projects.map((project) => (
              <li key={project.id} className="clip-reveal">
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-8">
            <Link href={routes.projects}>
              {t('allProjects')}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </Section>
      ) : null}

      <section aria-labelledby="join" className="relative overflow-hidden border-t border-border">
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          {/* The brand motif, entered by a scale-crop (H24) and moved by 8 % at most. */}
          <div className="parallax-soft absolute inset-x-0 -inset-y-[8%]">
            <div className="hero-scale-crop size-full bg-[url(/brand/overlay-mobile.svg)] bg-cover bg-bottom md:bg-[url(/brand/overlay-desktop.svg)] md:bg-right" />
          </div>
        </div>
        <Container className="relative grid justify-items-start gap-4 py-20 md:py-28">
          <SplitHeading
            id="join"
            className="font-display text-2xl font-extrabold text-balance md:text-4xl"
          >
            {t('joinTitle')}
          </SplitHeading>
          <Text size="lg" tone="muted">
            {t('joinBody')}
          </Text>
          <Button asChild size="lg" className="mt-2">
            <Link href={routes.signUp}>{t('join')}</Link>
          </Button>
        </Container>
      </section>
    </>
  );
}
