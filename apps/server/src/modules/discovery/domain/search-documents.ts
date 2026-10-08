import type { DiscoveryKind, VisibilityLevel } from '@pitchorium/contracts';

/**
 * Search projection (ADR 0065): one document per indexed entity and audience. `members` holds
 * what any signed-in member may see, `public` what a visitor may see; an entity that a visitor
 * may not see has no `public` document. The text is never broader than the matching page.
 */
export type Audience = 'public' | 'members';

export interface SearchDocument {
  kind: DiscoveryKind;
  entityId: string;
  audience: Audience;
  key: string;
  ownerId: string | null;
  name: string;
  subtitle: string | null;
  /** Free text of weight C. */
  body: string;
  countryCodes: string[];
  sectorCodes: string[];
  tags: string[];
  status: string | null;
  impactScore: number | null;
  amountMinor: bigint | null;
  currency: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  publishedAt: Date | null;
  featuredAt: Date | null;
}

export interface PersonSource {
  userId: string;
  handle: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  countryCode: string | null;
  city: string | null;
  languages: string[];
  publicPageEnabled: boolean;
  entrepreneurVisibility: VisibilityLevel;
  contributorVisibility: VisibilityLevel;
  entrepreneur: {
    companyName: string;
    sectorCode: string;
    stageCode: string;
    companyCountryCode: string;
    companyCity: string | null;
    pitch: string | null;
    needs: string[];
    soughtExpertise: string[];
    fundingTarget: { amountMinor: bigint; currency: string } | null;
  } | null;
  contributor: {
    hats: string[];
    structureType: string;
    organizationName: string | null;
    interventionCountryCodes: string[];
    sectorCodes: string[];
    ticket: { minMinor: bigint; maxMinor: bigint; currency: string } | null;
    acceptedInstruments: string[];
    mentoringAvailable: boolean;
    openToExpertMissions: boolean;
  } | null;
}

export interface OrganizationSource {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  structureType: string;
  countryCodes: string[];
  sectorCodes: string[];
  verified: boolean;
}

export interface ProjectSource {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  impactArea: string | null;
  sectorCode: string | null;
  countryCodes: string[];
  status: string;
  impactScore: number | null;
  instruments: string[];
  goalMinor: bigint | null;
  currency: string;
  ownerId: string;
  publishedAt: Date | null;
  endsAt: Date | null;
  featuredAt: Date | null;
}

export interface EventSource {
  id: string;
  slug: string;
  title: string;
  description: string;
  format: string;
  status: string;
  /** Visibility in force: `public` only with a public organizer. */
  visibility: 'public' | 'members';
  organizerId: string;
  organizationName: string | null;
  city: string | null;
  countryCodes: string[];
  sectorCodes: string[];
  language: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  publishedAt: Date | null;
}

export interface MissionSource {
  id: string;
  direction: string;
  title: string;
  description: string;
  kind: string;
  domain: string;
  skills: string[];
  mode: string;
  countryCodes: string[];
  sectorCodes: string[];
  languages: string[];
  /** Visibility in force: `public` only with a public author. */
  visibility: 'public' | 'members';
  authorId: string;
  publishedAt: Date;
}

const shown = (level: VisibilityLevel, audience: Audience) =>
  level === 'public' || (audience === 'members' && level === 'members');

const unique = (values: readonly (string | null | undefined)[]): string[] => [
  ...new Set(values.filter((value): value is string => typeof value === 'string' && value !== '')),
];

const text = (...parts: readonly (string | null | undefined)[]) =>
  parts.filter((part) => part).join('\n');

const NO_NUMBERS = {
  status: null,
  impactScore: null,
  amountMinor: null,
  currency: null,
  startsAt: null,
  endsAt: null,
  featuredAt: null,
};

/**
 * A member: base profile for members, plus the facets whose details they show to members; the
 * public document exists only with the public page, with the facets shown publicly (ADR 0017).
 */
export function personDocuments(source: PersonSource): SearchDocument[] {
  const audiences: Audience[] = source.publicPageEnabled ? ['members', 'public'] : ['members'];
  return audiences.map((audience) => {
    const entrepreneur = shown(source.entrepreneurVisibility, audience)
      ? source.entrepreneur
      : null;
    const contributor = shown(source.contributorVisibility, audience) ? source.contributor : null;
    return {
      kind: 'person',
      entityId: source.userId,
      audience,
      key: source.handle,
      ownerId: source.userId,
      name: source.displayName,
      subtitle: source.headline,
      body: text(
        source.bio,
        source.city,
        entrepreneur?.companyName,
        entrepreneur?.companyCity,
        entrepreneur?.pitch,
        entrepreneur?.soughtExpertise.join(', '),
        contributor?.organizationName,
      ),
      countryCodes: unique([
        source.countryCode,
        entrepreneur?.companyCountryCode,
        ...(contributor?.interventionCountryCodes ?? []),
      ]),
      sectorCodes: unique([entrepreneur?.sectorCode, ...(contributor?.sectorCodes ?? [])]),
      tags: unique([
        entrepreneur ? 'facet:entrepreneur' : null,
        contributor ? 'facet:contributor' : null,
        ...(contributor?.hats.map((hat) => `hat:${hat}`) ?? []),
        contributor?.mentoringAvailable ? 'mentoring' : null,
        ...source.languages.map((language) => `lang:${language}`),
      ]),
      ...NO_NUMBERS,
      publishedAt: null,
    };
  });
}

/** An organization page is public (ADR 0025): the same document for both audiences. */
export function organizationDocuments(source: OrganizationSource): SearchDocument[] {
  return (['members', 'public'] as const).map((audience) => ({
    kind: 'organization',
    entityId: source.id,
    audience,
    key: source.slug,
    ownerId: null,
    name: source.name,
    subtitle: null,
    body: text(source.description),
    countryCodes: unique(source.countryCodes),
    sectorCodes: unique(source.sectorCodes),
    tags: unique([`structure:${source.structureType}`, source.verified ? 'verified' : null]),
    ...NO_NUMBERS,
    publishedAt: null,
  }));
}

/** A published project is public (§11.2). */
export function projectDocuments(source: ProjectSource): SearchDocument[] {
  return (['members', 'public'] as const).map((audience) => ({
    kind: 'project',
    entityId: source.id,
    audience,
    key: source.slug,
    ownerId: source.ownerId,
    name: source.title,
    subtitle: source.summary,
    body: text(source.description, source.impactArea),
    countryCodes: unique(source.countryCodes),
    sectorCodes: unique([source.sectorCode]),
    tags: unique([
      ...source.instruments.map((instrument) => `instrument:${instrument}`),
      source.featuredAt ? 'featured' : null,
    ]),
    status: source.status,
    impactScore: source.impactScore,
    amountMinor: source.goalMinor,
    currency: source.currency,
    startsAt: null,
    endsAt: source.endsAt,
    publishedAt: source.publishedAt,
    featuredAt: source.featuredAt,
  }));
}

export function eventDocuments(source: EventSource): SearchDocument[] {
  const audiences: Audience[] =
    source.visibility === 'public' ? ['members', 'public'] : ['members'];
  return audiences.map((audience) => ({
    kind: 'event',
    entityId: source.id,
    audience,
    key: source.slug,
    ownerId: source.organizerId,
    name: source.title,
    subtitle: source.organizationName,
    body: text(source.description, source.city),
    countryCodes: unique(source.countryCodes),
    sectorCodes: unique(source.sectorCodes),
    tags: unique([`format:${source.format}`, `lang:${source.language}`, `tz:${source.timeZone}`]),
    status: source.status,
    impactScore: null,
    amountMinor: null,
    currency: null,
    startsAt: source.startsAt,
    endsAt: source.endsAt,
    publishedAt: source.publishedAt,
    featuredAt: null,
  }));
}

export function missionDocuments(source: MissionSource): SearchDocument[] {
  const audiences: Audience[] =
    source.visibility === 'public' ? ['members', 'public'] : ['members'];
  return audiences.map((audience) => ({
    kind: 'mission',
    entityId: source.id,
    audience,
    key: source.id,
    ownerId: source.authorId,
    name: source.title,
    subtitle: source.domain,
    body: text(source.description, source.skills.join(', ')),
    countryCodes: unique(source.countryCodes),
    sectorCodes: unique(source.sectorCodes),
    tags: unique([
      `direction:${source.direction}`,
      `kind:${source.kind}`,
      `mode:${source.mode}`,
      ...source.languages.map((language) => `lang:${language}`),
    ]),
    status: 'open',
    impactScore: null,
    amountMinor: null,
    currency: null,
    startsAt: null,
    endsAt: null,
    publishedAt: source.publishedAt,
    featuredAt: null,
  }));
}

/** Values of a tag family: `tagValues(['hat:mentor', 'lang:fr'], 'hat')` gives `['mentor']`. */
export function tagValues(tags: readonly string[], family: string): string[] {
  const prefix = `${family}:`;
  return tags.filter((tag) => tag.startsWith(prefix)).map((tag) => tag.slice(prefix.length));
}
