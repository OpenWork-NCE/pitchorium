import type { Locale, Project } from '@pitchorium/contracts';
import { getImageProps } from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';
import { Avatar, Badge, Heading, Text, VerifiedBadge } from '@/components/ui';
import { routes } from '@/config/routes';
import { siteConfig } from '@/config/site';
import { MemberHoverCard } from '@/features/profiles';
import { Link } from '@/i18n/navigation';
import { countryNames } from '../../lib/countries';

/**
 * The main block of a project (§11.2): its visual, entered by a scale-crop (H24), its status, its
 * sector and countries, its title revealed in D4, its summary, the holder with the preview of
 * their profile, the carrying organisation with its badge, and the self-declared impact.
 */
export async function ProjectHero({
  project,
  locale,
  signedIn,
  editorial,
  impact,
}: {
  project: Project;
  locale: Locale;
  signedIn: boolean;
  /** The public view, an editorial page (D4): its title rises word by word from masks. */
  editorial: boolean;
  /** The impact badge, linked to the methodology and to the detail (client island). */
  impact: ReactNode;
}) {
  const t = await getTranslations('web.projects.page');
  const reference = await getTranslations('reference');
  const cover = project.gallery[0] ?? null;
  const sector = project.sectorCode;
  const countries = countryNames(project.countryCodes, locale);
  return (
    <header className="grid gap-6">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-cover-placeholder sm:aspect-[21/9]">
        <span
          aria-hidden
          className="absolute inset-0 bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center dark:brightness-[2.6]"
        />
        {cover ? (
          // The props of next/image computed on the server, a plain <img> in the page: the same
          // optimised sources, without the client component of the image (ADR 0094).
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            {...getImageProps({
              src: cover.url,
              alt: cover.alt ?? '',
              fill: true,
              priority: true,
              // A draft serves its images by presigned addresses (private files, ADR 0026): the
              // optimiser of Next.js only reads the public files of the CDN.
              unoptimized: !siteConfig.cdnUrl || !cover.url.startsWith(siteConfig.cdnUrl),
              sizes: '(min-width: 1024px) 760px, 100vw',
              className: 'hero-scale-crop object-cover',
            }).props}
          />
        ) : null}
      </div>
      <div className="editorial-reveal grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={project.status === 'draft' ? 'neutral' : 'accent'}>
            {reference(`projectStatuses.${project.status}`)}
          </Badge>
          {sector && reference.has(`sectors.${sector}` as never) ? (
            <Badge title={reference(`sectors.${sector}` as never)}>
              <span aria-hidden>
                {reference.has(`sectorsShort.${sector}` as never)
                  ? reference(`sectorsShort.${sector}` as never)
                  : reference(`sectors.${sector}` as never)}
              </span>
              <span className="sr-only">{reference(`sectors.${sector}` as never)}</span>
            </Badge>
          ) : null}
          {countries.map((name) => (
            <Badge key={name}>{name}</Badge>
          ))}
        </div>
        <Heading
          level={1}
          size="display"
          className={editorial ? 'title-reveal text-balance' : 'text-balance'}
        >
          {editorial ? <RevealedTitle title={project.title} /> : project.title}
        </Heading>
        {project.summary ? (
          <Text size="lg" tone="muted" className="max-w-prose text-pretty">
            {project.summary}
          </Text>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {project.owner ? (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar
                name={project.owner.displayName}
                src={project.owner.avatarUrl}
                size="md"
                decorative
              />
              <div className="grid min-w-0 text-sm">
                <span className="text-muted">{t('carriedBy')}</span>
                <MemberHoverCard member={project.owner} signedIn={signedIn} />
              </div>
            </div>
          ) : null}
          {project.organization ? (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar
                name={project.organization.name}
                src={project.organization.logoUrl}
                size="md"
                shape="square"
                decorative
              />
              <div className="grid min-w-0 text-sm">
                <span className="text-muted">{t('organization')}</span>
                <span className="flex items-center gap-1.5">
                  <Link
                    href={routes.organization(project.organization.slug)}
                    className="truncate link-underline-hover font-medium text-foreground"
                  >
                    {project.organization.name}
                  </Link>
                  {project.organization.verified ? <VerifiedBadge /> : null}
                </span>
              </div>
            </div>
          ) : null}
          {impact}
        </div>
      </div>
    </header>
  );
}

/**
 * The words of a title, each in its mask, rising one after the other (H13, word stagger), in CSS
 * only: rendered by the server, painted at once, never hidden by a script that arrives later.
 * With less motion, plain words (globals.css).
 */
function RevealedTitle({ title }: { title: string }) {
  const words = title.split(/\s+/).filter(Boolean);
  return words.map((word, index) => (
    <span key={index}>
      <span className="title-word">
        <span style={{ '--word': index } as CSSProperties}>{word}</span>
      </span>
      {index < words.length - 1 ? ' ' : null}
    </span>
  ));
}
