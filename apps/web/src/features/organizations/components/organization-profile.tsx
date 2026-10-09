import type { Locale, Organization } from '@pitchorium/contracts';
import { CalendarDays, Globe, MapPin, Settings } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Heading,
  Link,
  Tag,
  Text,
  VerifiedBadge,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { MemberHoverCard } from '@/features/profiles';
import { Link as LocaleLink } from '@/i18n/navigation';
import { countryName } from '@/lib/format/countries';
import { formatNames } from '@/lib/format/list';
import { canManage } from '../lib/roles';

/** A code of the reference data, labelled; the code itself when its label is missing. */
type Translate = Awaited<ReturnType<typeof getTranslations<'reference'>>>;
function label(t: Translate, group: string, code: string): string {
  const key = `${group}.${code}`;
  return t.has(key as never) ? t(key as never) : code;
}

/**
 * The page of an organisation (§10.7, ADR 0101): cover and logo, name and badge of a verification
 * granted by Pitchorium, type, countries, site and year; the presentation, the members the api
 * lists for the reader (public profiles only for a visitor), the projects it carries and
 * supports. Its owners and admins find the way to its management.
 */
export async function OrganizationProfile({
  organization,
  view,
  locale,
  actions,
}: {
  organization: Organization;
  view: 'member' | 'visitor';
  locale: Locale;
  /** Follow (network feature) for a member, the way in for a visitor. */
  actions?: ReactNode;
}) {
  const t = await getTranslations('web.organizations.page');
  const reference = await getTranslations('reference');
  const countries = organization.countryCodes.map((code) => countryName(code, locale));
  const projects = [
    { key: 'carried', items: organization.projects.carried },
    { key: 'supported', items: organization.projects.supported },
  ] as const;
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="grid min-w-0 content-start gap-6 lg:col-span-8">
        <Card padding="none" className="overflow-hidden" data-organization-header="">
          <div className="relative aspect-[3/1] bg-cover-placeholder sm:aspect-[4/1]">
            {organization.coverUrl ? (
              <Image
                src={organization.coverUrl}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 680px, 100vw"
                className="object-cover object-center"
              />
            ) : (
              <div
                aria-hidden
                className="size-full bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center"
              />
            )}
          </div>
          <div className="grid gap-4 px-5 pb-5 md:px-6 md:pb-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Avatar
                name={organization.name}
                src={organization.logoUrl}
                size="2xl"
                shape="square"
                className="-mt-14 bg-surface ring-4 ring-surface sm:-mt-16"
                decorative
              />
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                {actions}
                {canManage(organization.viewerRole) ? (
                  <Button asChild variant="outline">
                    <LocaleLink href={routes.organizationManage(organization.slug)}>
                      <Settings aria-hidden />
                      {t('manage')}
                    </LocaleLink>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Heading level={1} size="page" className="min-w-0 break-words">
                  {organization.name}
                </Heading>
                {organization.verification.verified ? (
                  <VerifiedBadge description={t('verified')} />
                ) : null}
                {organization.viewerRole ? (
                  <Badge tone="accent">
                    {reference(`organizationRoles.${organization.viewerRole}`)}
                  </Badge>
                ) : null}
              </div>
              <Text size="lg">{reference(`structureTypes.${organization.structureType}`)}</Text>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {countries.length > 0 ? (
                <li className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4" />
                  <span className="sr-only">{t('countries')}</span>
                  {formatNames(countries, locale)}
                </li>
              ) : null}
              {organization.foundedYear ? (
                <li className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden className="size-4" />
                  {t('founded', { year: String(organization.foundedYear) })}
                </li>
              ) : null}
              {organization.websiteUrl ? (
                <li className="inline-flex items-center gap-1.5">
                  <Globe aria-hidden className="size-4" />
                  <Link
                    href={organization.websiteUrl}
                    external={{ newTabLabel: t('newTab') }}
                    variant="standalone"
                  >
                    {t('website')}
                  </Link>
                </li>
              ) : null}
            </ul>
            {organization.sectorCodes.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label={t('sectors')}>
                {organization.sectorCodes.map((code) => (
                  <li key={code}>
                    <Tag>{label(reference, 'sectors', code)}</Tag>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>
        {organization.description ? (
          <Card className="grid gap-3" data-organization-section="about">
            <Heading level={2} size="section">
              {t('about')}
            </Heading>
            <Text prose className="whitespace-pre-line">
              {organization.description}
            </Text>
          </Card>
        ) : null}
        {projects.map(({ key, items }) =>
          items.length > 0 ? (
            <Card key={key} className="grid gap-3" data-organization-section={key}>
              <Heading level={2} size="section">
                {t(`projects.${key}`)}
              </Heading>
              <ul className="grid gap-2">
                {items.map((project) => (
                  <li key={project.projectId}>
                    <LocaleLink
                      href={routes.project(project.slug)}
                      className="link-underline-hover font-medium"
                    >
                      {project.title}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null,
        )}
      </div>
      <div className="grid min-w-0 content-start gap-6 lg:col-span-4">
        <Card padding="sm" className="grid gap-3" data-organization-section="members">
          <Heading level={2} size="label">
            {t('members')}
          </Heading>
          {organization.members.length > 0 ? (
            <ul className="grid gap-3">
              {organization.members.map((member) => (
                <li key={member.handle} className="flex items-center gap-3">
                  <Avatar name={member.displayName} src={member.avatarUrl} size="md" decorative />
                  <div className="grid min-w-0 gap-0.5">
                    <MemberHoverCard member={member} signedIn={view === 'member'} />
                    <span className="text-xs text-muted">
                      {reference(`organizationRoles.${member.role}`)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Text size="sm" tone="muted">
              {t(view === 'visitor' ? 'noPublicMembers' : 'noMembers')}
            </Text>
          )}
        </Card>
      </div>
    </div>
  );
}
