import { useTranslations } from 'next-intl';
import { Container } from '@/components/layout/container';
import { SplitHeading } from '@/components/motion/split-heading';
import { Button, Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { EditorialHeader } from './editorial-header';
import { type PreviewId, ProductPreview } from './product-preview';

const JOURNEYS = {
  entrepreneurs: ['enter', 'present', 'verify', 'receive'],
  contributors: ['discover', 'choose', 'pay', 'follow'],
} as const;

/**
 * The numbered steps of one audience, its title revealed in lines (H13), beside a preview of the
 * product that shows where they lead (ADR 0162).
 */
function Journey({
  id,
  title,
  steps,
  preview,
  className,
}: {
  id: string;
  title: string;
  steps: readonly { title: string; body: string }[];
  preview: { id: PreviewId; alt: string };
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn('py-16 md:py-24', className)}>
      <Container>
        <SplitHeading
          id={id}
          className="font-display text-2xl font-extrabold text-balance md:text-4xl"
        >
          {title}
        </SplitHeading>
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <ol className="grid gap-8 sm:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step.title} className="grid content-start gap-3 border-t border-border pt-4">
                <span
                  aria-hidden
                  className="font-numeric text-3xl font-extrabold text-accent tabular-nums"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Heading level={3} size="card">
                  {step.title}
                </Heading>
                <Text tone="muted">{step.body}</Text>
              </li>
            ))}
          </ol>
          <div className="clip-reveal grid place-items-center overflow-hidden rounded-2xl bg-accent-subtle p-6 sm:p-10">
            <ProductPreview
              id={preview.id}
              alt={preview.alt}
              sizes="(min-width: 1024px) 520px, 90vw"
              className="w-full"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** How it works (§6, §7, §9.3, §11, ADR 0156): one section for each audience, step by step. */
export function HowItWorksPage() {
  const t = useTranslations('web.marketing.howItWorks');
  const home = useTranslations('web.marketing.home');
  const previews = useTranslations('web.marketing.previews');
  return (
    <>
      <EditorialHeader title={t('title')} lede={t('lede')} />
      <Journey
        id="entrepreneurs"
        title={t('entrepreneursTitle')}
        preview={{ id: 'project-page', alt: previews('project-page') }}
        steps={JOURNEYS.entrepreneurs.map((step) => ({
          title: t(`entrepreneurs.${step}.title`),
          body: t(`entrepreneurs.${step}.body`),
        }))}
      />
      <Journey
        id="contributors"
        title={t('contributorsTitle')}
        preview={{ id: 'dashboard', alt: previews('dashboard') }}
        className="border-t border-border"
        steps={JOURNEYS.contributors.map((step) => ({
          title: t(`contributors.${step}.title`),
          body: t(`contributors.${step}.body`),
        }))}
      />
      <Container className="flex flex-wrap gap-3 border-t border-border py-12">
        <Button asChild size="lg">
          <Link href={routes.signUp}>{home('join')}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={routes.transparency}>{t('transparencyLink')}</Link>
        </Button>
      </Container>
    </>
  );
}
