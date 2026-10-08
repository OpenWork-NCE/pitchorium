import { Injectable } from '@nestjs/common';
import {
  type ModerationDecisionKind,
  type ReportTargetType,
  uuidV7Schema,
} from '@pitchorium/contracts';
import { ContentFacade } from '../../content';
import { EventsFacade } from '../../events';
import { MediaFacade } from '../../media';
import { MessagingFacade, type ReportedMessageContext } from '../../messaging';
import { MissionsFacade } from '../../missions';
import { OrganizationsFacade } from '../../organizations';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';

/** A reported target as moderation needs it. */
export interface ResolvedTarget {
  targetId: string;
  /** Member concerned by a decision: author, owner, organizer or sender. */
  subjectId: string | null;
  /** The project (or the project of the update) is in a funding campaign. */
  fundingActive: boolean;
  messageContext: ReportedMessageContext | null;
}

const FUNDING_STATUSES: ReadonlySet<string> = new Set(['funding', 'funded']);

/**
 * Finds the reported targets through the facades of the modules that own them, and applies
 * the moderation status decided by trust to them. Each module keeps its own tables.
 */
@Injectable()
export class TargetDirectory {
  constructor(
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly content: ContentFacade,
    private readonly projects: ProjectsFacade,
    private readonly events: EventsFacade,
    private readonly missions: MissionsFacade,
    private readonly messaging: MessagingFacade,
    private readonly media: MediaFacade,
  ) {}

  /**
   * Null when the target does not exist or does not show to the reporter. A message is
   * reported by a participant only; a profile by its handle.
   */
  async resolve(
    type: ReportTargetType,
    rawId: string,
    reporterId: string | null,
  ): Promise<ResolvedTarget | null> {
    if (type === 'profile') {
      const userId = await this.profiles.userIdOf(rawId, reporterId);
      return userId ? target(userId, userId) : null;
    }
    const parsed = uuidV7Schema.safeParse(rawId);
    if (!parsed.success) return null;
    const id = parsed.data;
    switch (type) {
      case 'organization': {
        if (!(await this.organizations.summaries([id])).has(id)) return null;
        const [owner] = await this.organizations.memberIds(id, ['owner']);
        return target(id, owner ?? null);
      }
      case 'post': {
        const author = await this.content.postAuthorId(id);
        if (!author) return null;
        if (reporterId && !(await this.content.visiblePosts(reporterId, [id])).has(id)) {
          return null;
        }
        return target(id, author);
      }
      case 'comment': {
        const author = await this.content.commentAuthorId(id);
        return author ? target(id, author) : null;
      }
      case 'project': {
        const project = await this.projects.fundable(id);
        if (!project) return null;
        return {
          ...target(id, project.ownerId),
          fundingActive: FUNDING_STATUSES.has(project.status),
        };
      }
      case 'project_update': {
        const update = await this.projects.updateAuthor(id);
        if (!update) return null;
        const project = await this.projects.fundable(update.projectId);
        return {
          ...target(id, update.authorId),
          fundingActive: project !== null && FUNDING_STATUSES.has(project.status),
        };
      }
      case 'event': {
        const event = (await this.events.summaries([id])).get(id);
        return event ? target(id, event.organizerId) : null;
      }
      case 'mission': {
        const author = await this.missions.authorOf(id);
        return author ? target(id, author) : null;
      }
      case 'message': {
        if (!reporterId) return null;
        const context = await this.messaging.reportContext(id, reporterId);
        return context ? { ...target(id, context.senderId), messageContext: context } : null;
      }
      case 'media': {
        const media = await this.media.describe(id);
        return media ? target(id, media.ownerId) : null;
      }
    }
  }

  /** Funding state of a project target, read again when a case is decided. */
  async fundingActive(type: ReportTargetType, id: string): Promise<boolean> {
    if (type !== 'project') return false;
    const project = await this.projects.fundable(id);
    return project !== null && FUNDING_STATUSES.has(project.status);
  }

  /**
   * Applies a decision to the target in its module, or reverts it (an overturned appeal);
   * joins the current transaction.
   */
  async apply(
    kind: ModerationDecisionKind,
    type: ReportTargetType,
    id: string,
    revert = false,
  ): Promise<void> {
    if (kind === 'freeze_project') {
      await this.projects.setFundingFrozen(id, !revert);
      return;
    }
    if (kind !== 'hide' && kind !== 'remove') return;
    const status = revert ? 'visible' : kind === 'hide' ? 'hidden' : 'removed';
    switch (type) {
      case 'post':
        return this.content.setPostModerationStatus(id, status);
      case 'comment':
        return this.content.setCommentModerationStatus(id, status);
      case 'project':
        return this.projects.setModerationStatus(id, status);
      case 'project_update':
        return this.projects.setUpdateModerationStatus(id, status);
      case 'event':
        return this.events.setModerationStatus(id, status);
      case 'mission':
        return this.missions.setModerationStatus(id, status);
      case 'message':
        return this.messaging.setMessageModerationStatus(id, status);
      case 'media':
        // A file is either served or removed.
        return this.media.setModerationStatus(id, revert ? 'none' : 'removed');
      case 'profile':
      case 'organization':
        return;
    }
  }

  /** Current handles of reported profiles, for the reporters' list. */
  async handles(userIds: readonly string[], viewerId: string): Promise<Map<string, string>> {
    const cards = await this.profiles.memberCards(userIds, viewerId);
    return new Map([...cards].map(([userId, card]) => [userId, card.handle]));
  }
}

function target(targetId: string, subjectId: string | null): ResolvedTarget {
  return { targetId, subjectId, fundingActive: false, messageContext: null };
}
