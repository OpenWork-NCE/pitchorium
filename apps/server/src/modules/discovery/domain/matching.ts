import {
  type ContributorHat,
  type EntrepreneurNeed,
  type MatchingRule,
  NEED_TO_HATS,
  type SuggestionReason,
  type SuggestionSentence,
  type TimeEntryKind,
} from '@pitchorium/contracts';

/**
 * Explained matching (§2.1, §10.2, §11.4, ADR 0067): readable rules, no black box. Each rule
 * adds its weight to the score and gives a reason (an i18n key of the `discovery` namespace and
 * its parameters). The rules of the prototype are missing: rules and weights are provisional
 * (docs/open-questions.md) and versioned, a change of a weight or a rule increments the version.
 */
export const MATCHING_RULES_VERSION = 1;

export const MATCHING_WEIGHTS: Readonly<Record<MatchingRule, number>> = {
  need_matches_hat: 35,
  hat_matches_need: 35,
  mission_matches_need: 35,
  mission_matches_hat: 35,
  same_country_other_sector: 30,
  same_sector_other_country: 30,
  shared_sector: 20,
  country_in_intervention: 20,
  intervenes_in_country: 20,
  event_in_country: 20,
  mentoring_available: 15,
  mentoring_wanted: 15,
  ticket_fits_target: 15,
  instruments_compatible: 10,
  mission_reachable: 10,
  shared_language: 10,
};

/** A candidate needs at least this score to be suggested. */
export const MIN_SCORE = 20;
/** Suggestions kept per list and subject. */
export const SUGGESTIONS_PER_LIST = 50;
/** Candidates scored per list, chosen by indexed filters before the score (ADR 0068). */
export const CANDIDATE_CAP = 500;
/** Subjects updated at most when a candidate changes (incremental update). */
export const REVERSE_CAP = 2000;

export interface Money {
  minor: bigint;
  currency: string;
}

export interface EntrepreneurSide {
  sector: string;
  companyCountry: string;
  needs: readonly EntrepreneurNeed[];
  fundingTarget: Money | null;
}

export interface ContributorSide {
  hats: readonly ContributorHat[];
  interventionCountries: readonly string[];
  sectors: readonly string[];
  ticket: { min: bigint; max: bigint; currency: string } | null;
  instruments: readonly string[];
  mentoringAvailable: boolean;
}

/**
 * A member as matching sees them. As a candidate, a facet whose details are private to its
 * member is absent (it would show in the reasons).
 */
export interface PersonProfile {
  userId: string;
  name: string;
  residenceCountry: string | null;
  languages: readonly string[];
  entrepreneur: EntrepreneurSide | null;
  contributor: ContributorSide | null;
}

export interface ProjectProfile {
  projectId: string;
  title: string;
  ownerId: string | null;
  sector: string | null;
  countries: readonly string[];
  instruments: readonly string[];
  goal: Money | null;
}

export interface MissionProfile {
  missionId: string;
  title: string;
  authorId: string | null;
  direction: 'offer' | 'request';
  kind: TimeEntryKind;
  sectors: readonly string[];
  countries: readonly string[];
  remote: boolean;
  languages: readonly string[];
}

export interface EventProfile {
  eventId: string;
  title: string;
  organizerId: string | null;
  sectors: readonly string[];
  countries: readonly string[];
  language: string;
}

export interface Match {
  score: number;
  /** The heaviest first. */
  reasons: SuggestionReason[];
}

const KIND_TO_NEED: Readonly<Record<TimeEntryKind, EntrepreneurNeed>> = {
  mentoring: 'mentoring',
  expertise: 'expertise',
};
const KIND_TO_HAT: Readonly<Record<TimeEntryKind, ContributorHat>> = {
  mentoring: 'mentor',
  expertise: 'expert',
};

const ORDER = Object.keys(MATCHING_WEIGHTS) as MatchingRule[];

function reason(rule: MatchingRule, key: string, params: Record<string, string>): SuggestionReason {
  return { rule, key: `reasons.${key}`, params, weight: MATCHING_WEIGHTS[rule] };
}

const first = <T>(values: readonly T[], keep: (value: T) => boolean): T | undefined =>
  values.find(keep);

/** Each rule counts once; the score is the sum of the weights of the rules that applied. */
export function compose(reasons: readonly (SuggestionReason | null | undefined)[]): Match {
  const byRule = new Map<MatchingRule, SuggestionReason>();
  for (const item of reasons) if (item && !byRule.has(item.rule)) byRule.set(item.rule, item);
  const sorted = [...byRule.values()].sort(
    (a, b) => b.weight - a.weight || ORDER.indexOf(a.rule) - ORDER.indexOf(b.rule),
  );
  return { score: sorted.reduce((sum, item) => sum + item.weight, 0), reasons: sorted };
}

/** « Suggéré parce que {first} » or « ... {first} et que {second} »: the two heaviest reasons. */
export function sentenceOf(reasons: readonly SuggestionReason[]): SuggestionSentence {
  const clauses = reasons.slice(0, 2).map((item) => ({ key: item.key, params: item.params }));
  return { key: clauses.length > 1 ? 'sentences.two' : 'sentences.one', clauses };
}

export function isSuggested(match: Match): boolean {
  return match.score >= MIN_SCORE;
}

function fitsTicket(target: Money | null, ticket: ContributorSide['ticket']): boolean {
  return (
    target !== null &&
    ticket !== null &&
    target.currency === ticket.currency &&
    target.minor >= ticket.min &&
    target.minor <= ticket.max
  );
}

/** The entrepreneur needs what the contributor offers, from the entrepreneur's side. */
function asSeeker(seeker: EntrepreneurSide, helper: ContributorSide, name: string) {
  const need = first(seeker.needs, (item) =>
    NEED_TO_HATS[item].some((hat) => helper.hats.includes(hat)),
  );
  const hat = need ? NEED_TO_HATS[need].find((item) => helper.hats.includes(item)) : undefined;
  const country = helper.interventionCountries.includes(seeker.companyCountry);
  return [
    need && hat ? reason('need_matches_hat', 'need_matches_hat', { need, hat, name }) : null,
    seeker.needs.includes('mentoring') && helper.mentoringAvailable
      ? reason('mentoring_available', 'mentoring_available', { name })
      : null,
    helper.sectors.includes(seeker.sector)
      ? reason('shared_sector', 'shared_sector', { sector: seeker.sector, name })
      : null,
    country
      ? reason('country_in_intervention', 'country_in_intervention.seeker', {
          country: seeker.companyCountry,
          name,
        })
      : null,
    fitsTicket(seeker.fundingTarget, helper.ticket)
      ? reason('ticket_fits_target', 'ticket_fits_target.seeker', { name })
      : null,
  ];
}

/** The same relation from the contributor's side. */
function asHelper(helper: ContributorSide, seeker: EntrepreneurSide, name: string) {
  const need = first(seeker.needs, (item) =>
    NEED_TO_HATS[item].some((hat) => helper.hats.includes(hat)),
  );
  const hat = need ? NEED_TO_HATS[need].find((item) => helper.hats.includes(item)) : undefined;
  return [
    need && hat ? reason('hat_matches_need', 'hat_matches_need', { need, hat, name }) : null,
    helper.mentoringAvailable && seeker.needs.includes('mentoring')
      ? reason('mentoring_wanted', 'mentoring_wanted', { name })
      : null,
    helper.sectors.includes(seeker.sector)
      ? reason('shared_sector', 'shared_sector', { sector: seeker.sector, name })
      : null,
    helper.interventionCountries.includes(seeker.companyCountry)
      ? reason('intervenes_in_country', 'intervenes_in_country', {
          country: seeker.companyCountry,
          name,
        })
      : null,
    fitsTicket(seeker.fundingTarget, helper.ticket)
      ? reason('ticket_fits_target', 'ticket_fits_target.helper', { name })
      : null,
  ];
}

/**
 * « Personnes pertinentes pour vous » (§10.2): contributors for the entrepreneur side of the
 * viewer, entrepreneurs for their contributor side.
 */
export function matchPerson(viewer: PersonProfile, candidate: PersonProfile): Match {
  if (viewer.userId === candidate.userId) return compose([]);
  return compose([
    ...(viewer.entrepreneur && candidate.contributor
      ? asSeeker(viewer.entrepreneur, candidate.contributor, candidate.name)
      : []),
    ...(viewer.contributor && candidate.entrepreneur
      ? asHelper(viewer.contributor, candidate.entrepreneur, candidate.name)
      : []),
  ]);
}

/**
 * « Entrepreneurs complémentaires » (§2.1, §10.2): same country and other sector, or same
 * sector and other country.
 */
export function matchComplementary(viewer: PersonProfile, candidate: PersonProfile): Match {
  const mine = viewer.entrepreneur;
  const theirs = candidate.entrepreneur;
  if (!mine || !theirs || viewer.userId === candidate.userId) return compose([]);
  const sameCountry = mine.companyCountry === theirs.companyCountry;
  const sameSector = mine.sector === theirs.sector;
  return compose([
    sameCountry && !sameSector
      ? reason('same_country_other_sector', 'same_country_other_sector', {
          country: theirs.companyCountry,
          sector: theirs.sector,
          name: candidate.name,
        })
      : null,
    sameSector && !sameCountry
      ? reason('same_sector_other_country', 'same_sector_other_country', {
          sector: theirs.sector,
          country: theirs.companyCountry,
          name: candidate.name,
        })
      : null,
  ]);
}

/** Projects for the contributor side of the viewer (§11.4). */
export function matchProject(viewer: PersonProfile, project: ProjectProfile): Match {
  const helper = viewer.contributor;
  if (!helper || project.ownerId === viewer.userId) return compose([]);
  return compose(projectReasons(helper, project, project.title, 'helper'));
}

/** Potential contributors of a project, shown to its team (§11.4). */
export function matchContributor(project: ProjectProfile, candidate: PersonProfile): Match {
  const helper = candidate.contributor;
  if (!helper || project.ownerId === candidate.userId) return compose([]);
  return compose(projectReasons(helper, project, candidate.name, 'team'));
}

function projectReasons(
  helper: ContributorSide,
  project: ProjectProfile,
  name: string,
  side: 'helper' | 'team',
) {
  const sector = project.sector && helper.sectors.includes(project.sector) ? project.sector : null;
  const country = first(project.countries, (item) => helper.interventionCountries.includes(item));
  const instrument = first(project.instruments, (item) => helper.instruments.includes(item));
  return [
    sector ? reason('shared_sector', 'shared_sector', { sector, name }) : null,
    country
      ? side === 'helper'
        ? reason('intervenes_in_country', 'intervenes_in_country', { country, name })
        : reason('country_in_intervention', 'country_in_intervention.team', { country, name })
      : null,
    fitsTicket(project.goal, helper.ticket)
      ? reason(
          'ticket_fits_target',
          `ticket_fits_target.${side === 'helper' ? 'project' : 'team'}`,
          {
            name,
          },
        )
      : null,
    instrument
      ? reason('instruments_compatible', `instruments_compatible.${side}`, { instrument, name })
      : null,
  ];
}

function countriesOf(person: PersonProfile): string[] {
  return [
    ...(person.residenceCountry ? [person.residenceCountry] : []),
    ...(person.entrepreneur ? [person.entrepreneur.companyCountry] : []),
    ...(person.contributor?.interventionCountries ?? []),
  ];
}

function sectorsOf(person: PersonProfile): string[] {
  return [
    ...(person.entrepreneur ? [person.entrepreneur.sector] : []),
    ...(person.contributor?.sectors ?? []),
  ];
}

/**
 * Missions for the viewer: an offer that answers a need of their entrepreneur side, a request
 * that fits a hat of their contributor side, reachable (remote, or in one of their countries).
 */
export function matchMission(viewer: PersonProfile, mission: MissionProfile): Match {
  if (mission.authorId === viewer.userId) return compose([]);
  const need = KIND_TO_NEED[mission.kind];
  const hat = KIND_TO_HAT[mission.kind];
  const relevant =
    mission.direction === 'offer'
      ? viewer.entrepreneur?.needs.includes(need) === true
      : viewer.contributor?.hats.includes(hat) === true;
  if (!relevant) return compose([]);
  const name = mission.title;
  const sector = first(mission.sectors, (item) => sectorsOf(viewer).includes(item));
  const country = first(mission.countries, (item) => countriesOf(viewer).includes(item));
  const language = first(mission.languages, (item) => viewer.languages.includes(item));
  return compose([
    mission.direction === 'offer'
      ? reason('mission_matches_need', 'mission_matches_need', { need, name })
      : reason('mission_matches_hat', 'mission_matches_hat', { hat, name }),
    sector ? reason('shared_sector', 'shared_sector', { sector, name }) : null,
    mission.remote
      ? reason('mission_reachable', 'mission_reachable.remote', { name })
      : country
        ? reason('mission_reachable', 'mission_reachable.country', { country, name })
        : null,
    language ? reason('shared_language', 'shared_language', { language, name }) : null,
  ]);
}

/** Events for the viewer: their sectors, their countries, a language they speak. */
export function matchEvent(viewer: PersonProfile, event: EventProfile): Match {
  if (event.organizerId === viewer.userId) return compose([]);
  const name = event.title;
  const sector = first(event.sectors, (item) => sectorsOf(viewer).includes(item));
  const country = first(event.countries, (item) => countriesOf(viewer).includes(item));
  const reasons = compose([
    sector ? reason('shared_sector', 'shared_sector', { sector, name }) : null,
    country ? reason('event_in_country', 'event_in_country', { country, name }) : null,
  ]);
  // The language alone never suggests an event.
  if (reasons.reasons.length === 0) return reasons;
  return compose([
    ...reasons.reasons,
    viewer.languages.includes(event.language)
      ? reason('shared_language', 'shared_language', { language: event.language, name })
      : null,
  ]);
}
