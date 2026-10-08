import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';
import { memberCardSchema } from './profiles.js';

/**
 * Types of notifications (§10.5 and the events of the other modules, ADR 0059). Each has its
 * labels under `notifications.types.<type>` in @pitchorium/i18n.
 */
export const NOTIFICATION_TYPES = [
  'connection_request',
  'connection_accepted',
  'new_follower',
  'reaction',
  'comment',
  'mention',
  'followed_post',
  'message',
  'message_request',
  'message_request_accepted',
  'introduction_proposed',
  'introduction_completed',
  'introduction_declined',
  'profile_views',
  'project_contribution',
  'tier_unlocked',
  'project_update',
  'project_ending_soon',
  'project_funded',
  'project_closed',
  'project_interest',
  'project_team_invitation',
  'project_team_joined',
  'project_team_invitation_declined',
  'organization_invitation',
  'organization_member_joined',
  'organization_role_changed',
  'organization_ownership_transferred',
  'organization_verification_decided',
  'kyc_decided',
  'contribution_refunded',
  'offline_contribution_declared',
  'offline_contribution_decided',
  'time_entry_declared',
  'time_entry_answered',
  'security_alert',
  'event_registration_confirmed',
  'event_waitlist_promoted',
  'event_reminder',
  'event_canceled',
  'mission_engagement_requested',
  'mission_engagement_answered',
  'mission_completed',
  'new_suggestions',
  'report_received',
  'report_resolved',
  'moderation_decision',
  'suspension_started',
  'suspension_ended',
  'appeal_received',
  'appeal_decided',
  'export_ready',
  'erasure_scheduled',
  'erasure_reminder',
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/** Channels a member chooses; a push channel is prepared server-side, not offered yet. */
export const NOTIFICATION_CHANNELS = ['in_app', 'email'] as const;
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);

/** Email digest (ADR 0061): `off` sends each email at once. */
export const EMAIL_DIGESTS = ['off', 'daily', 'weekly'] as const;
export const emailDigestSchema = z.enum(EMAIL_DIGESTS);

export const NOTIFICATION_PRIORITIES = ['normal', 'low'] as const;
export const notificationPrioritySchema = z.enum(NOTIFICATION_PRIORITIES);

/** What a notification opens; `path` is the route of the web app. */
export const NOTIFICATION_TARGET_TYPES = [
  'member',
  'post',
  'conversation',
  'message_requests',
  'introduction',
  'project',
  'project_invitations',
  'organization',
  'organization_invitations',
  'contribution',
  'payout_account',
  'offline_contribution',
  'time_entry',
  'profile_views',
  'connection_requests',
  'account_security',
  'event',
  'mission_engagement',
  'suggestions',
  'reports',
  'moderation_decision',
  'moderation',
  'privacy',
] as const;
export const notificationTargetTypeSchema = z.enum(NOTIFICATION_TARGET_TYPES);

export const notificationSchema = z.object({
  id: uuidV7Schema,
  type: notificationTypeSchema,
  priority: notificationPrioritySchema,
  /** The most recent actors visible to the reader (three at most). */
  actors: z.array(memberCardSchema),
  /** Every actor of the grouped events: « Amina et 12 autres ». */
  actorCount: z.number().int(),
  /** Events grouped in this notification. */
  eventCount: z.number().int(),
  target: z.object({ type: notificationTargetTypeSchema, key: z.string(), path: z.string() }),
  /** Identifiers and codes of the source event (reaction type, decision, tier position...). */
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const notificationPageSchema = cursorPageSchema(notificationSchema);
export const notificationListQuerySchema = cursorPageQuerySchema.extend({
  unread: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export const notificationIdParamsSchema = z.object({ notificationId: uuidV7Schema });

export const notificationTypePreferenceSchema = z.object({
  type: notificationTypeSchema,
  /** Security, payments, KYC and legal terms: always sent, not editable. */
  transactional: z.boolean(),
  channels: z.object({ in_app: z.boolean(), email: z.boolean() }),
});

export const notificationPreferencesSchema = z.object({
  emailDigest: emailDigestSchema,
  types: z.array(notificationTypePreferenceSchema),
});

export const updateNotificationPreferencesRequestSchema = z.object({
  emailDigest: emailDigestSchema.optional(),
  changes: z
    .array(
      z.object({
        type: notificationTypeSchema,
        channel: notificationChannelSchema,
        enabled: z.boolean(),
      }),
    )
    .max(NOTIFICATION_TYPES.length * NOTIFICATION_CHANNELS.length)
    .default([]),
});

/** Unified counters, also pushed in real time (event `counters`). */
export const countersSchema = z.object({
  notifications: z.number().int(),
  messages: z.object({ unread: z.number().int(), conversations: z.number().int() }),
  messageRequests: z.number().int(),
  invitations: z.object({
    connections: z.number().int(),
    introductions: z.number().int(),
    projects: z.number().int(),
    organizations: z.number().int(),
  }),
});

/** One-click unsubscribe (RFC 8058): the signed token of the email. */
export const unsubscribeQuerySchema = z.object({ token: z.string().min(16).max(512) });
export const unsubscribeResultSchema = z.object({
  scope: z.union([notificationTypeSchema, z.literal('digest')]),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type EmailDigest = z.infer<typeof emailDigestSchema>;
export type NotificationPriority = z.infer<typeof notificationPrioritySchema>;
export type NotificationTargetType = z.infer<typeof notificationTargetTypeSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationTypePreference = z.infer<typeof notificationTypePreferenceSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type UpdateNotificationPreferencesRequest = z.infer<
  typeof updateNotificationPreferencesRequestSchema
>;
export type Counters = z.infer<typeof countersSchema>;
export type UnsubscribeResult = z.infer<typeof unsubscribeResultSchema>;
