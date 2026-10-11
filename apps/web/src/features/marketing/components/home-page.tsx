import type { ProjectCard as ProjectCardData } from '@pitchorium/contracts';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';
import { SplitHeading } from '@/components/motion/split-heading';
import { Button, Heading, Kicker, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { ProjectGrid } from '@/features/projects';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { EditorialHeader } from './editorial-header';
import { type PreviewId, preloadPreview, ProductPreview } from './product-preview';

const STEPS = ['first', 'second', 'third'] as const;
const PRINCIPLES = ['money', 'impact', 'languages', 'public'] as const;

/** Sizes of the previews of the hero: the page of a project behind, its funding in front. */
const HERO_SIZES = {
  page: '(min-width: 1280px) 560px, (min-width: 1024px) 45vw, 1px',
  funding: '(min-width: 1024px) 240px, 352px',
};

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
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={className ?? 'py-16 md:py-24'}>
      <Container>
        <Kicker>{kicker}</Kicker>
        <SplitHeading
          id={id}
          className="mt-3 max-w-3xl font-display text-3xl font-extrabold text-balance md:text-5xl"
        >
          {title}
        </SplitHeading>
        {children}
      </Container>
    </section>
  );
}

/**
 * The previews of the hero (ADR 0162): on a computer, the page of a project, its funding block in
 * front of it and a notification above, slightly overlapping, entering one after the other (D4)
 * and the page moved by 8 % at most with the scroll; below `lg`, the funding block alone, under
 * the title.
 */
function HeroPreviews() {
  const t = useTranslations('web.marketing.previews');
  preloadPreview('project-page', HERO_SIZES.page, '(min-width: 1024px)');
  return (
    <>
      <div className="relative hidden aspect-[6/5] lg:block">
        <div className="editorial-reveal absolute inset-0">
          <div className="absolute top-[8%] right-0 w-[88%]">
            <div className="parallax-soft">
              <ProductPreview
                id="project-page"
                alt={t('project-page')}
                sizes={HERO_SIZES.page}
                priority
                hiddenOn="(max-width: 1023.98px)"
              />
            </div>
          </div>
          <ProductPreview
            id="funding"
            alt={t('funding')}
            sizes={HERO_SIZES.funding}
            className="absolute bottom-0 left-0 aspect-[3/4] w-[40%]"
            imageClassName="object-cover object-top"
          />
          <ProductPreview
            id="notification"
            alt={t('notification')}
            sizes="(min-width: 1280px) 380px, 30vw"
            className="absolute top-0 right-[4%] w-[62%]"
          />
        </div>
      </div>
      <ProductPreview
        id="funding"
        alt={t('funding')}
        sizes={HERO_SIZES.funding}
        // A band of the block: the amount, the goal, the bar and the percentage. Smaller than the
        // title on a phone, which stays the largest paint of the first screen.
        className="mx-auto aspect-[5/2] w-full max-w-80 lg:hidden"
        imageClassName="h-full object-cover object-[center_18%]"
      />
    </>
  );
}

/** The stage of a preview in an editorial row: a tinted panel, the preview at its own scale. */
function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'clip-reveal relative grid place-items-center overflow-hidden rounded-2xl bg-accent-subtle p-6 sm:p-10',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** What each use shows: a stage of one or two previews, in their own proportions. */
function UseVisual({ use }: { use: 'connect' | 'discover' | 'support' }) {
  const t = useTranslations('web.marketing.previews');
  const preview = (id: PreviewId, sizes: string, className?: string, image?: string) => (
    <ProductPreview
      id={id}
      alt={t(id)}
      sizes={sizes}
      {...(className ? { className } : {})}
      {...(image ? { imageClassName: image } : {})}
    />
  );
  if (use === 'connect') {
    return (
      <Stage className="aspect-[5/4] place-items-start">
        {/* The list and the start of the thread: the image cropped in its frame, never the frame. */}
        {preview(
          'conversation',
          '(min-width: 768px) 840px, 135vw',
          'aspect-[4/3] w-full',
          'h-full object-cover object-left-top',
        )}
        {preview(
          'suggestion',
          '290px',
          'absolute right-6 bottom-6 aspect-[29/50] w-[46%] max-w-72 sm:right-10 sm:bottom-10',
          'object-cover object-top',
        )}
      </Stage>
    );
  }
  if (use === 'discover') {
    return (
      // On a phone, the hero already shows the funding of a project, just above.
      <Stage className="max-md:hidden md:aspect-[5/4]">
        {preview('funding', '352px', 'aspect-[4/5] w-full max-w-80', 'object-cover object-top')}
      </Stage>
    );
  }
  return (
    <Stage className="md:aspect-[5/4]">
      {preview('dashboard', '(min-width: 768px) 560px, 90vw', 'w-full')}
    </Stage>
  );
}

/**
 * Editorial home page (§3 to §5, ADR 0156, ADR 0162): the promise and the previews of the product,
 * the three uses as alternating editorial rows, the projects of the api laid out from their count,
 * the two audiences and their journeys, the commitments to the reader, then the call to join on a
 * deep violet band. Every text comes from the specification; no figure nor testimony is shown.
 */
export function HomePage({ projects }: { projects: readonly ProjectCardData[] }) {
  const t = useTranslations('web.marketing.home');
  return (
    <>
      <EditorialHeader
        kicker={t('kicker')}
        title={t('title')}
        lede={t('lede')}
        visual={<HeroPreviews />}
        // The promise holds « Afrique–Diaspora » on one line beside the previews, and on a phone.
        titleClassName="text-[2.5rem]/[1.05] sm:text-5xl lg:text-[clamp(2.75rem,4.4vw,4.25rem)]/[1.05]"
      >
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
        <div className="mt-12 grid gap-16 md:mt-16 md:gap-24">
          {(['connect', 'discover', 'support'] as const).map((use, index) => (
            <article
              key={use}
              aria-labelledby={`use-${use}`}
              className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-16"
            >
              <div className={cn('grid content-start gap-4', index % 2 === 1 && 'md:order-2')}>
                <Kicker>{t(`uses.${use}.kicker`)}</Kicker>
                <Heading
                  level={3}
                  id={`use-${use}`}
                  className="font-display text-2xl font-extrabold text-balance md:text-4xl"
                >
                  {t(`uses.${use}.title`)}
                </Heading>
                <Text size="lg" tone="muted" className="max-w-xl">
                  {t(`uses.${use}.body`)}
                </Text>
              </div>
              <UseVisual use={use} />
            </article>
          ))}
        </div>
      </Section>

      {projects.length > 0 ? (
        <Section
          id="projects"
          kicker={t('projectsKicker')}
          title={t('projectsTitle')}
          className="border-t border-border py-16 md:py-24"
        >
          <ProjectGrid
            projects={projects}
            itemClassName="clip-reveal"
            className="mt-10"
            data-home-projects=""
          />
          <Button asChild variant="outline" className="mt-8">
            <Link href={routes.projects}>
              {t('allProjects')}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </Section>
      ) : null}

      <Section
        id="audiences"
        kicker={t('audiencesKicker')}
        title={t('audiencesTitle')}
        className="border-y border-border bg-surface py-16 md:py-24"
      >
        <div className="mt-12 grid gap-12 md:grid-cols-2">
          {(['entrepreneur', 'contributor'] as const).map((audience) => (
            <div key={audience} className="grid content-start gap-4">
              <Heading level={3} size="card" className="text-xl">
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
        <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <div key={principle} className="border-t border-border pt-5">
              <dt className="text-xl font-semibold text-balance">
                {t(`principles.${principle}.title`)}
              </dt>
              <dd className="mt-2 text-muted">{t(`principles.${principle}.body`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* The one full-width moment: the promise on the deep violet of the brand panel. */}
      <section
        aria-labelledby="join"
        className="relative overflow-hidden bg-brand-panel text-on-brand-panel"
      >
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          {/* The brand motif, entered by a scale-crop (H24) and moved by 8 % at most. */}
          <div className="parallax-soft absolute inset-x-0 -inset-y-[8%]">
            <div className="hero-scale-crop size-full bg-[url(/brand/overlay-mobile.svg)] bg-cover bg-bottom opacity-80 md:bg-[url(/brand/overlay-desktop.svg)] md:bg-right" />
          </div>
        </div>
        <Container className="relative grid justify-items-start gap-5 py-20 md:py-28">
          <SplitHeading
            id="join"
            className="max-w-3xl font-display text-3xl font-extrabold text-balance md:text-5xl"
          >
            {t('joinTitle')}
          </SplitHeading>
          <p className="max-w-2xl text-lg opacity-90">{t('joinBody')}</p>
          {/* The main action in the colours of the band: brand white, its text in violet. */}
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-2 bg-on-brand-panel text-brand-panel hover:bg-on-brand-panel/90"
          >
            <Link href={routes.signUp}>{t('join')}</Link>
          </Button>
        </Container>
      </section>
    </>
  );
}
