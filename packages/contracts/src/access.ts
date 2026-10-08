import { z } from 'zod';
import { errorCodeSchema } from './errors/error-codes.js';
import { uuidV7Schema } from './ids.js';

export const ROLES = ['member', 'moderator', 'admin'] as const;
export const roleSchema = z.enum(ROLES);

/** `member` is implicit for every account and never stored. */
export const ASSIGNABLE_ROLES = ['moderator', 'admin'] as const;
export const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);

/**
 * Central registry of action names. Policies live in the access module; modules add their
 * actions here when they are implemented.
 */
export const ACTIONS = [
  'account.read',
  'account.preferences.update',
  'account.legal.accept',
  'profile.read',
  'profile.update',
  'access.roles.read',
  'access.roles.manage',
  'project.create',
  'project.read',
  'project.update',
  'project.delete',
  'project.publish',
  'project.team.manage',
  'project.team.leave',
  'project.invitation.respond',
  'project.updates.publish',
  'project.interest.express',
  'project.interest.read',
  'project.impact.assess',
  'impact.methodology.manage',
  'impact.assessment.submit',
  'impact.assessment.read',
  'media.upload',
  'media.read',
  'media.delete',
  'organization.read',
  'organization.create',
  'organization.update',
  'organization.delete',
  'organization.member.invite',
  'organization.member.manage',
  'organization.member.leave',
  'organization.ownership.transfer',
  'organization.invitation.respond',
  'organization.verification.request',
  'organization.verification.review',
  'network.read',
  'network.follow',
  'network.connection.request',
  'network.connection.respond',
  'network.connection.remove',
  'network.block',
  'network.settings.update',
  'network.profile-views.read',
  'content.feed.read',
  'content.post.read',
  'content.post.create',
  'content.post.update',
  'content.post.delete',
  'content.post.repost',
  'content.post.save',
  'content.post.hide',
  'content.post.stats.read',
  'content.reaction.set',
  'content.comment.create',
  'content.comment.update',
  'content.comment.delete',
  'payment.quote',
  'payment.contribute',
  'payment.contribute.organization',
  'payment.contribution.read',
  'payment.contribution.cancel',
  'payment.project.contributions.read',
  'payment.project.contributions.export',
  'payment.collection.open',
  'payment.offline.declare',
  'payment.offline.declare.team',
  'payment.offline.respond',
  'payment.offline.validate',
  'payment.payout.configure',
  'payment.kyc.submit',
  'payment.kyc.review',
  'payment.refund',
  'payment.reconciliation.manage',
  'engagement.dashboard.read',
  'engagement.organization.dashboard.read',
  'engagement.time.declare',
  'engagement.time.read',
  'engagement.time.respond',
  'messaging.read',
  'messaging.conversation.start',
  'messaging.conversation.participate',
  'messaging.message.update',
  'messaging.request.respond',
  'messaging.settings.update',
  'messaging.introduction.propose',
  'messaging.introduction.respond',
  'notifications.read',
  'notifications.manage',
  'notifications.preferences.update',
  'discovery.search',
  'discovery.page.read',
  'discovery.suggestions.read',
  'discovery.suggestions.dismiss',
  'discovery.project-suggestions.read',
  'event.read',
  'event.create',
  'event.update',
  'event.publish',
  'event.cancel',
  'event.delete',
  'event.register',
  'event.attendees.read',
  'event.calendar.manage',
  'mission.read',
  'mission.offer.create',
  'mission.request.create',
  'mission.update',
  'mission.close',
  'mission.engage',
  'mission.engagement.read',
  'mission.engagement.respond',
  'mission.engagement.complete',
  'mission.engagement.cancel',
  'trust.report.create',
  'trust.report.read',
  'trust.standing.read',
  'trust.decision.appeal',
  'trust.moderation.read',
  'trust.moderation.assign',
  'trust.moderation.decide',
  'trust.appeal.resolve',
  'trust.suspension.lift',
  'trust.project.refund',
  'trust.transparency.read',
  'privacy.read',
  'privacy.export.request',
  'privacy.erasure.request',
  'privacy.erasure.cancel',
  'privacy.requests.read',
  'localization.translate',
  'localization.manage',
  'admin.members.read',
  'admin.flags.read',
  'admin.flags.manage',
  'admin.highlights.manage',
  'admin.jobs.read',
  'admin.jobs.retry',
  'admin.stats.read',
  'admin.audit.read',
] as const;
export const actionSchema = z.enum(ACTIONS);

/** What a user may have to complete before an action is allowed. */
export const PREREQUISITE_ELEMENTS = [
  'legal_acceptance',
  'email_verified',
  'kyc_verified',
  'two_factor',
  'profile.entrepreneur_facet',
  'profile.contributor_facet',
  'payout_account',
] as const;
export const prerequisiteElementSchema = z.enum(PREREQUISITE_ELEMENTS);

export const trustLevelsSchema = z.object({
  emailVerified: z.boolean(),
  kycVerified: z.boolean(),
  suspended: z.boolean(),
});

export const actionPrerequisitesSchema = z.object({
  action: actionSchema,
  allowed: z.boolean(),
  /** Error code the action would fail with, null when allowed. */
  code: errorCodeSchema.nullable(),
  missing: z.array(prerequisiteElementSchema),
});

export const roleAssignmentSchema = z.object({
  role: assignableRoleSchema,
  grantedAt: z.iso.datetime(),
  /** Null when granted by the command line. */
  grantedBy: uuidV7Schema.nullable(),
});

export const userRolesSchema = z.object({
  userId: uuidV7Schema,
  assignments: z.array(roleAssignmentSchema),
});

export const grantRoleRequestSchema = z.object({ role: assignableRoleSchema });

export type Role = z.infer<typeof roleSchema>;
export type AssignableRole = z.infer<typeof assignableRoleSchema>;
export type Action = z.infer<typeof actionSchema>;
export type PrerequisiteElement = z.infer<typeof prerequisiteElementSchema>;
export type TrustLevels = z.infer<typeof trustLevelsSchema>;
export type ActionPrerequisites = z.infer<typeof actionPrerequisitesSchema>;
export type RoleAssignment = z.infer<typeof roleAssignmentSchema>;
export type UserRoles = z.infer<typeof userRolesSchema>;
