import { z } from 'zod';
import { timeEntryKindSchema } from './engagement.js';
import { eventFormatSchema } from './events.js';
import { uuidV7Schema } from './ids.js';
import { missionDirectionSchema, missionModeSchema } from './missions.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';
import {
  contributorHatSchema,
  countryCodeSchema,
  languageCodeSchema,
  referenceCodeSchema,
  structureTypeSchema,
} from './profiles.js';
import { projectStatusSchema, publicProjectStatusSchema } from './projects.js';

/** What the search bar finds (§10.6), and what a suggestion proposes. */
export const DISCOVERY_KINDS = ['person', 'organization', 'project', 'event', 'mission'] as const;
export const discoveryKindSchema = z.enum(DISCOVERY_KINDS);

export const SEARCH_QUERY_MAX_LENGTH = 100;

/** Comma-separated list in a query string (`kinds=project,event`). */
const csvKinds = z
  .string()
  .max(200)
  .transform((value) => value.split(',').filter((part) => part.length > 0))
  .pipe(z.array(z.enum(DISCOVERY_KINDS)).min(1));

export const searchQuerySchema = cursorPageQuerySchema.extend({
  q: z.string().trim().max(SEARCH_QUERY_MAX_LENGTH).optional(),
  kinds: csvKinds.optional(),
  countryCode: countryCodeSchema.optional(),
  sectorCode: referenceCodeSchema.optional(),
  language: languageCodeSchema.optional(),
  /** Projects (§10.6): in funding, funded, closed; minimum self-declared impact. */
  projectStatus: publicProjectStatusSchema.optional(),
  minImpact: z.coerce.number().int().min(0).max(100).optional(),
  /** People: facet and hat. */
  facet: z.enum(['entrepreneur', 'contributor']).optional(),
  hat: contributorHatSchema.optional(),
  mentoring: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  /** Organizations: type of structure, verified only. */
  structureType: structureTypeSchema.optional(),
  verified: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  /** Events: format; past events are left out unless `includePast`. */
  eventFormat: eventFormatSchema.optional(),
  includePast: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  /** Missions: direction, kind, mode. */
  missionDirection: missionDirectionSchema.optional(),
  missionKind: timeEntryKindSchema.optional(),
  missionMode: missionModeSchema.optional(),
});

export const autocompleteQuerySchema = z.object({
  q: z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH),
  kinds: csvKinds.optional(),
  limit: z.coerce.number().int().min(1).max(10).default(8),
});

const resultBase = {
  /** Public key: handle of a member, slug of an organization, project or event, id of a mission. */
  key: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  imageUrl: z.string().nullable(),
  countryCodes: z.array(z.string()),
  sectorCodes: z.array(z.string()),
};

/** A card of the search, the suggestions and the Discover page, by kind. */
export const discoveryCardSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('person'),
    ...resultBase,
    facets: z.object({ entrepreneur: z.boolean(), contributor: z.boolean() }),
    hats: z.array(contributorHatSchema),
  }),
  z.object({
    kind: z.literal('organization'),
    ...resultBase,
    structureType: structureTypeSchema,
    verified: z.boolean(),
  }),
  z.object({
    kind: z.literal('project'),
    ...resultBase,
    status: projectStatusSchema,
    impactScore: z.number().int().nullable(),
    endsAt: z.iso.datetime().nullable(),
  }),
  z.object({
    kind: z.literal('event'),
    ...resultBase,
    format: eventFormatSchema,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    timeZone: z.string(),
  }),
  z.object({
    kind: z.literal('mission'),
    ...resultBase,
    direction: missionDirectionSchema,
    missionKind: timeEntryKindSchema,
    mode: missionModeSchema,
  }),
]);

export const searchResultPageSchema = cursorPageSchema(discoveryCardSchema);

export const autocompleteItemSchema = z.object({
  kind: discoveryKindSchema,
  key: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
});
export const autocompleteResultSchema = z.object({ items: z.array(autocompleteItemSchema) });

/** Rules of the explained matching (ADR 0067); provisional (docs/open-questions.md). */
export const MATCHING_RULES = [
  'need_matches_hat',
  'hat_matches_need',
  'mentoring_available',
  'mentoring_wanted',
  'shared_sector',
  'country_in_intervention',
  'intervenes_in_country',
  'ticket_fits_target',
  'instruments_compatible',
  'same_country_other_sector',
  'same_sector_other_country',
  'mission_matches_need',
  'mission_matches_hat',
  'mission_reachable',
  'event_in_country',
  'shared_language',
] as const;
export const matchingRuleSchema = z.enum(MATCHING_RULES);

/**
 * One reason of a suggestion: an i18n key of the `discovery` namespace and its parameters, codes
 * for labelled values (need, hat, sector, country, instrument, language) and the display name.
 */
export const suggestionReasonSchema = z.object({
  rule: matchingRuleSchema,
  key: z.string(),
  params: z.record(z.string(), z.string()),
  weight: z.number().int(),
});

/**
 * The sentence shown under a suggestion, built by the client: `discovery.sentences.one` with
 * `{first}`, or `.two` with `{first}` and `{second}`, each the text of a clause.
 */
export const suggestionSentenceSchema = z.object({
  key: z.string(),
  clauses: z.array(z.object({ key: z.string(), params: z.record(z.string(), z.string()) })),
});

export const SUGGESTION_LISTS = [
  'people',
  'complementary_entrepreneurs',
  'projects',
  'missions',
  'events',
] as const;
export const suggestionListSchema = z.enum(SUGGESTION_LISTS);

export const suggestionSchema = z.object({
  candidate: discoveryCardSchema,
  score: z.number().int(),
  sentence: suggestionSentenceSchema,
  /** Every rule that contributed, the heaviest first. */
  reasons: z.array(suggestionReasonSchema),
  rulesVersion: z.number().int(),
});

export const suggestionsQuerySchema = cursorPageQuerySchema.extend({
  list: suggestionListSchema,
});
export const suggestionPageSchema = cursorPageSchema(suggestionSchema);

export const dismissSuggestionRequestSchema = z.object({
  kind: discoveryKindSchema,
  key: z.string().min(1).max(100),
});
export const dismissalParamsSchema = z.object({
  kind: discoveryKindSchema,
  key: z.string().min(1).max(100),
});

/** Sections of the Discover page (§10.6), each paginated for a wide grid. */
export const DISCOVER_SECTIONS = [
  'recent_projects',
  'ending_soon_projects',
  'suggested_profiles',
  'editorial',
  'upcoming_events',
  'open_missions',
] as const;
export const discoverSectionSchema = z.enum(DISCOVER_SECTIONS);

export const discoverSectionPageSchema = z.object({
  section: discoverSectionSchema,
  items: z.array(discoveryCardSchema),
  /** Suggested profiles carry their reason, in the order of the items. */
  sentences: z.array(suggestionSentenceSchema.nullable()),
  nextCursor: z.string().nullable(),
});

export const discoverPageSchema = z.object({
  sections: z.array(discoverSectionPageSchema),
});

export const discoverPageQuerySchema = z.object({
  /** Items per section on the first page (a grid row is often 4 or 6). */
  limit: z.coerce.number().int().min(1).max(24).default(8),
});

export const discoverSectionParamsSchema = z.object({ section: discoverSectionSchema });

/** A suggestion completing a feed whose network produces too little (ADR 0032). */
export const feedSuggestionSchema = z.object({
  candidate: discoveryCardSchema,
  sentence: suggestionSentenceSchema,
});

export const projectIdForSuggestionsParamsSchema = z.object({ projectId: uuidV7Schema });

export type DiscoveryKind = z.infer<typeof discoveryKindSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type AutocompleteQuery = z.infer<typeof autocompleteQuerySchema>;
export type DiscoveryCard = z.infer<typeof discoveryCardSchema>;
export type AutocompleteItem = z.infer<typeof autocompleteItemSchema>;
export type MatchingRule = z.infer<typeof matchingRuleSchema>;
export type SuggestionReason = z.infer<typeof suggestionReasonSchema>;
export type SuggestionSentence = z.infer<typeof suggestionSentenceSchema>;
export type SuggestionList = z.infer<typeof suggestionListSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type DiscoverSection = z.infer<typeof discoverSectionSchema>;
export type DiscoverSectionPage = z.infer<typeof discoverSectionPageSchema>;
export type DiscoverPage = z.infer<typeof discoverPageSchema>;
export type FeedSuggestion = z.infer<typeof feedSuggestionSchema>;
