import type { Locale, OwnProfile, ProfileView, Relationship } from '@pitchorium/contracts';
import { Building2, Globe, Link2, MapPin, MessagesSquare } from 'lucide-react';
import Image from 'next/image';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CopyButton,
  Count,
  Heading,
  Link,
  Text,
  VerifiedBadge,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { siteConfig } from '@/config/site';
import { Link as LocaleLink } from '@/i18n/navigation';
import { countryName } from '@/lib/format/countries';
import { formatList } from '@/lib/format/list';
import { pluralOf } from '@/lib/i18n/plural-of';
import { languageName } from '../lib/options';
import { EditButton, ProfileEditorProvider, ProfileStrength } from './owner-tools';
import { ContributorSection, EntrepreneurSection } from './profile-facets';

export interface MemberProfileProps {
  profile: ProfileView;
  /** Visitor (public page) or member: the api already applied what each may see. */
  view: 'member' | 'visitor';
  locale: Locale;
  /** The profile of the reader themselves, with what only its owner reads (strength). */
  own: OwnProfile | null;
  /** Relationship of a member reader with this one; null for a visitor or the owner. */
  relationship: Relationship | null;
  /** Actions of the reader towards the member (network feature), or the way in of a visitor. */
  actions?: ReactNode;
  /** Column beside the profile on a wide screen (who viewed the profile, for its owner). */
  aside?: ReactNode;
}

/**
 * The page of a member (§10.1, ADR 0101): cover and photo, name, title, place, languages and
 * links, the linked organisation and its badge, the relationship and the counts the api gives,
 * then the presentation and the two facets. The rules of privacy are the api's: an absent group
 * is never rebuilt here (ADR 0113). The owner edits each part in place (ProfileEditorProvider).
 */
export async function MemberProfile({
  profile,
  view,
  locale,
  own,
  relationship,
  actions,
  aside,
}: MemberProfileProps) {
  const t = await getTranslations('web.profile.page');
  const editable = own !== null;
  const content = (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="grid min-w-0 content-start gap-6 lg:col-span-8">
        <ProfileHeader
          profile={profile}
          locale={locale}
          relationship={relationship}
          actions={actions}
          editable={editable}
        />
        <AboutSection profile={profile} editable={editable} />
        <EntrepreneurSection profile={profile} locale={locale} editable={editable} />
        <ContributorSection profile={profile} locale={locale} editable={editable} />
      </div>
      <div className="grid min-w-0 content-start gap-6 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:col-span-4 lg:self-start">
        {own ? <ProfileStrength strength={own.strength} /> : null}
        {own ? <OwnAddress own={own} locale={locale} /> : null}
        {aside}
        {view === 'visitor' ? (
          <Card padding="sm" className="grid gap-2">
            <Heading level={2} size="label">
              {t('joinTitle')}
            </Heading>
            <Text size="sm" tone="muted">
              {t('joinBody', { name: profile.displayName })}
            </Text>
          </Card>
        ) : null}
      </div>
    </div>
  );
  return own ? (
    <ProfileEditorProvider own={own} locale={locale}>
      {content}
    </ProfileEditorProvider>
  ) : (
    content
  );
}

async function ProfileHeader({
  profile,
  locale,
  relationship,
  actions,
  editable,
}: {
  profile: ProfileView;
  locale: Locale;
  relationship: Relationship | null;
  actions?: ReactNode;
  editable: boolean;
}) {
  const t = await getTranslations('web.profile.page');
  const reference = await getTranslations('reference');
  const format = await getFormatter();
  const place = [
    profile.city,
    profile.countryCode ? countryName(profile.countryCode, locale) : null,
  ].filter(Boolean);
  const languages = profile.languages.map((code) => languageName(code, locale));
  const organization = profile.contributorOrganization;
  const counts = relationship?.counts ?? null;
  const mutual = relationship?.mutualConnections;
  const degree = relationship?.degree;

  return (
    <Card padding="none" className="overflow-hidden" data-profile-header="">
      <div className="relative aspect-[3/1] bg-cover-placeholder sm:aspect-[4/1]">
        {profile.coverUrl ? (
          <Image
            src={profile.coverUrl}
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
        {editable ? (
          <EditButton section="cover" className="absolute top-3 right-3" variant="secondary" />
        ) : null}
      </div>
      <div className="grid gap-4 px-5 pb-5 md:px-6 md:pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="relative -mt-14 sm:-mt-16">
            <Avatar
              name={profile.displayName}
              src={profile.avatarUrl}
              size="2xl"
              className="ring-4 ring-surface"
              decorative
            />
            {editable ? (
              <EditButton
                section="photo"
                className="absolute right-0 bottom-0"
                variant="secondary"
              />
            ) : null}
          </div>
          {actions ? <div className="min-w-0">{actions}</div> : null}
        </div>
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level={1} size="page" className="min-w-0 break-words">
              {profile.displayName}
            </Heading>
            {degree && degree !== 'self' ? (
              <Badge tone="accent">{reference(`relationDegrees.${degree}`)}</Badge>
            ) : null}
            {editable ? <EditButton section="intro" /> : null}
          </div>
          {profile.headline ? <Text size="lg">{profile.headline}</Text> : null}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          {place.length > 0 ? (
            <li className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden className="size-4" />
              <span className="sr-only">{t('location')}</span>
              {place.join(', ')}
            </li>
          ) : null}
          {languages.length > 0 ? (
            <li className="inline-flex items-center gap-1.5">
              <MessagesSquare aria-hidden className="size-4" />
              {t('languages', { list: formatList(languages, locale) })}
            </li>
          ) : null}
          {organization ? (
            <li className="inline-flex items-center gap-1.5">
              <Building2 aria-hidden className="size-4" />
              <LocaleLink
                href={routes.organization(organization.slug)}
                className="link-underline-hover font-medium text-foreground"
              >
                {organization.name}
              </LocaleLink>
              {organization.verified ? (
                <VerifiedBadge description={t('verifiedOrganization')} />
              ) : null}
            </li>
          ) : null}
          {profile.links.website ? (
            <li className="inline-flex items-center gap-1.5">
              <Globe aria-hidden className="size-4" />
              <Link
                href={profile.links.website}
                external={{ newTabLabel: t('newTab') }}
                variant="standalone"
              >
                {t('website')}
              </Link>
            </li>
          ) : null}
          {profile.links.linkedin ? (
            <li className="inline-flex items-center gap-1.5">
              <Link2 aria-hidden className="size-4" />
              <Link
                href={profile.links.linkedin}
                external={{ newTabLabel: t('newTab') }}
                variant="standalone"
              >
                {t('linkedin')}
              </Link>
            </li>
          ) : null}
        </ul>
        {mutual && mutual.count > 0 ? (
          <Text size="sm" tone="muted">
            {t(`mutual.${pluralOf(locale, mutual.count)}`, {
              count: `${format.number(mutual.count)}${mutual.capped ? '+' : ''}`,
            })}
          </Text>
        ) : null}
        {counts ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {(['connections', 'followers'] as const).map((kind) => (
              <div key={kind} className="flex items-baseline gap-1.5">
                <dd className="order-first font-numeric text-base font-semibold tabular-nums">
                  <Count value={counts[kind]} />
                </dd>
                <dt className="text-muted">
                  <LocaleLink
                    href={`${routes.memberNetwork(profile.handle)}?tab=${kind}`}
                    className="link-underline-hover"
                  >
                    {t(`${kind}.${pluralOf(locale, counts[kind])}`)}
                  </LocaleLink>
                </dt>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </Card>
  );
}

async function AboutSection({ profile, editable }: { profile: ProfileView; editable: boolean }) {
  const t = await getTranslations('web.profile.page');
  if (!profile.bio && !editable) return null;
  return (
    <Card className="grid gap-3" data-profile-section="about">
      <div className="flex items-center justify-between gap-3">
        <Heading level={2} size="section">
          {t('about')}
        </Heading>
        {editable ? <EditButton section="about" /> : null}
      </div>
      {profile.bio ? (
        <Text prose className="whitespace-pre-line">
          {profile.bio}
        </Text>
      ) : (
        <Text size="sm" tone="muted">
          {t('aboutEmpty')}
        </Text>
      )}
    </Card>
  );
}

/**
 * For the owner: the address of the profile (copied, or changed with its redirect) and whether
 * its public page is open, with the way to the setting.
 */
async function OwnAddress({ own, locale }: { own: OwnProfile; locale: Locale }) {
  const t = await getTranslations('web.profile.page');
  const address = new URL(`/${locale}${routes.member(own.handle)}`, siteConfig.url).toString();
  return (
    <Card padding="sm" className="grid gap-3" data-profile-address="">
      <div className="flex items-center justify-between gap-3">
        <Heading level={2} size="label">
          {t('address')}
        </Heading>
        <EditButton section="handle" />
      </div>
      <code className="font-mono text-sm break-all">{address}</code>
      <CopyButton value={address} label={t('copyAddress')} />
      <div className="grid gap-1.5 border-t border-border pt-3">
        <Text size="sm">{t(own.visibility.publicPageEnabled ? 'publicOn' : 'publicOff')}</Text>
        <Button asChild size="sm" variant="outline" className="justify-self-start">
          <LocaleLink href={routes.settingsPrivacy}>{t('privacySettings')}</LocaleLink>
        </Button>
      </div>
    </Card>
  );
}
