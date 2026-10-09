import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { cursorPageSchema } from './pagination.js';
import { handleSchema, memberCardSchema } from './profiles.js';

/** Maximum length of the note sent with a connection request (§10.2). */
export const CONNECTION_NOTE_MAX_LENGTH = 300;

/**
 * Kind of a followed target. `member` and `organization` exist; other modules register more
 * (`project` with the projects module), so the API accepts any well-formed type and answers
 * 404 for a type nobody registered.
 */
export const followTargetTypeSchema = z.string().regex(/^[a-z][a-z_]{1,31}$/);
/** Public key of a target: handle of a member, identifier of an organization. */
export const followTargetKeySchema = z.string().min(1).max(100);

export const followTargetParamsSchema = z.object({
  targetType: followTargetTypeSchema,
  targetKey: followTargetKeySchema,
});

export const followTargetSchema = z.object({
  type: followTargetTypeSchema,
  key: z.string(),
  displayName: z.string(),
  /** Headline of a member, type of structure of an organization. */
  subtitle: z.string().nullable(),
  imageUrl: z.string().nullable(),
  /** Key of the page of the target: handle of a member, slug of an organization or a project. */
  slug: z.string().nullable(),
});

export const followSchema = z.object({
  target: followTargetSchema,
  followedAt: z.iso.datetime(),
});

/**
 * The reader and a target: whether they follow it, and how many members do; null for a member,
 * whose count follows the visibility of their lists (read in the relationship).
 */
export const followStateSchema = z.object({
  following: z.boolean(),
  followers: z.number().int().nonnegative().nullable(),
});

export const followerSchema = z.object({
  member: memberCardSchema,
  followedAt: z.iso.datetime(),
});

export const connectionSchema = z.object({
  member: memberCardSchema,
  connectedAt: z.iso.datetime(),
});

export const followingQuerySchema = z.object({ type: followTargetTypeSchema.optional() });

export const CONNECTION_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
  'cancelled',
] as const;
export const connectionRequestStatusSchema = z.enum(CONNECTION_REQUEST_STATUSES);

export const CONNECTION_REQUEST_DIRECTIONS = ['received', 'sent'] as const;
export const connectionRequestDirectionSchema = z.enum(CONNECTION_REQUEST_DIRECTIONS);

export const createConnectionRequestSchema = z.object({
  handle: handleSchema,
  /** Optional context, for example « Nous nous sommes croisés à... ». */
  note: z.string().trim().min(1).max(CONNECTION_NOTE_MAX_LENGTH).optional(),
});

export const connectionRequestSchema = z.object({
  id: uuidV7Schema,
  direction: connectionRequestDirectionSchema,
  /** The other member: the addressee of a sent request, the requester of a received one. */
  member: memberCardSchema,
  note: z.string().nullable(),
  status: connectionRequestStatusSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  respondedAt: z.iso.datetime().nullable(),
});

export const connectionRequestsQuerySchema = z.object({
  direction: connectionRequestDirectionSchema.default('received'),
});

export const connectionRequestParamsSchema = z.object({ requestId: uuidV7Schema });
export const memberHandleParamsSchema = z.object({ handle: handleSchema });
export const organizationFollowersParamsSchema = z.object({ organizationId: uuidV7Schema });

/** Degree of relation, computed up to the second degree only (ADR 0028). */
export const RELATION_DEGREES = ['self', 'first', 'second', 'out_of_network'] as const;
export const relationDegreeSchema = z.enum(RELATION_DEGREES);

export const CONNECTION_STATES = ['connected', 'request_sent', 'request_received', 'none'] as const;
export const connectionStateSchema = z.enum(CONNECTION_STATES);

export const relationshipSchema = z.object({
  degree: relationDegreeSchema,
  mutualConnections: z.object({
    count: z.number().int().nonnegative(),
    /** True when the count reached its computation cap and shows « cap+ ». */
    capped: z.boolean(),
  }),
  connection: connectionStateSchema,
  /** Pending request between the two members, if any. */
  requestId: uuidV7Schema.nullable(),
  /** The viewer follows the member. */
  following: z.boolean(),
  /** The member follows the viewer. */
  followedBy: z.boolean(),
  /** The viewer blocked the member. */
  blocked: z.boolean(),
  /** Null when the member's network lists are hidden from the viewer. */
  counts: z.object({ followers: z.number().int(), connections: z.number().int() }).nullable(),
});

export const blockSchema = z.object({
  member: memberCardSchema,
  blockedAt: z.iso.datetime(),
});

export const networkSettingsSchema = z.object({
  /** Private visits: visited members see an anonymized mention instead of the visitor. */
  privateProfileViews: z.boolean(),
});
export const updateNetworkSettingsSchema = networkSettingsSchema.partial();

export const profileViewsSummarySchema = z.object({
  last7Days: z.number().int(),
  last30Days: z.number().int(),
  last90Days: z.number().int(),
  /** Days of views kept (NETWORK_PROFILE_VIEWS_RETENTION_DAYS). */
  retentionDays: z.number().int(),
});

export const profileVisitSchema = z.object({
  /** Day of the visit (UTC), one visit per visitor and day. */
  day: z.iso.date(),
  /** Null for a private visit. */
  visitor: memberCardSchema.nullable(),
  /** Anonymized mention of a private visit, « un membre du secteur X ». */
  anonymous: z.object({ sectorCode: z.string().nullable() }).nullable(),
});

export const followPageSchema = cursorPageSchema(followSchema);
export const followerPageSchema = cursorPageSchema(followerSchema);
export const connectionPageSchema = cursorPageSchema(connectionSchema);
export const connectionRequestPageSchema = cursorPageSchema(connectionRequestSchema);
export const blockPageSchema = cursorPageSchema(blockSchema);
export const profileVisitPageSchema = cursorPageSchema(profileVisitSchema);

export type FollowTarget = z.infer<typeof followTargetSchema>;
export type Follow = z.infer<typeof followSchema>;
export type FollowState = z.infer<typeof followStateSchema>;
export type Follower = z.infer<typeof followerSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type ConnectionRequestStatus = z.infer<typeof connectionRequestStatusSchema>;
export type ConnectionRequestDirection = z.infer<typeof connectionRequestDirectionSchema>;
export type CreateConnectionRequest = z.infer<typeof createConnectionRequestSchema>;
export type ConnectionRequest = z.infer<typeof connectionRequestSchema>;
export type RelationDegree = z.infer<typeof relationDegreeSchema>;
export type ConnectionState = z.infer<typeof connectionStateSchema>;
export type Relationship = z.infer<typeof relationshipSchema>;
export type Block = z.infer<typeof blockSchema>;
export type NetworkSettings = z.infer<typeof networkSettingsSchema>;
export type ProfileViewsSummary = z.infer<typeof profileViewsSummarySchema>;
export type ProfileVisit = z.infer<typeof profileVisitSchema>;
