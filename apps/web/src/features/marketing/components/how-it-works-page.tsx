import { useTranslations } from 'next-intl';
import { Container } from '@/components/layout/container';
import { SplitHeading } from '@/components/motion/split-heading';
import { Button, Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { EditorialHeader } from './editorial-header';

const JOURNEYS = {
  entrepreneurs: ['enter', 'present', 'verify', 'receive'],
  contributors: ['discover', 'choose', 'pay', 'follow'],
} as const;

/** The numbered steps of one audience, its title revealed in lines (H13). */
function Journey({
  id,
  title,
  steps,
  className,
}: {
  id: string;
  title: string;
  steps: readonly { title: string; body: string }[];
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
        <ol className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
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
      </Container>
    </section>
  );
}

/** How it works (§6, §7, §9.3, §11, ADR 0156): one section for each audience, step by step. */
export function HowItWorksPage() {
  const t = useTranslations('web.marketing.howItWorks');
  const home = useTranslations('web.marketing.home');
  return (
    <>
      <EditorialHeader title={t('title')} lede={t('lede')} />
      <Journey
        id="entrepreneurs"
        title={t('entrepreneursTitle')}
        steps={JOURNEYS.entrepreneurs.map((step) => ({
          title: t(`entrepreneurs.${step}.title`),
          body: t(`entrepreneurs.${step}.body`),
        }))}
      />
      <Journey
        id="contributors"
        title={t('contributorsTitle')}
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
