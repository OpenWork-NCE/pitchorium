import { Injectable } from '@nestjs/common';
import type { ExpressInterestRequest } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import type { InterestRecord } from '../domain/activity';
import { assertCurrency, isPublished } from '../domain/project';
import { InterestExpressed } from '../domain/project-events';
import { ProjectEventsRecorder } from './project-events.recorder';
import { ProjectRepository } from './ports';

/** Resource of the documents of an expression of interest in the media module. */
export const PROJECT_INTEREST_RESOURCE = 'project_interest';

/**
 * Expressions of interest (sections 9.1 and 11.2): grant, honour loan, equity, or general
 * contact, with a message, an indicative non-binding amount and private documents. Read by the
 * team only; no payment.
 */
@Injectable()
export class InterestsService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly media: MediaFacade,
    private readonly events: ProjectEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async express(
    projectId: string,
    userId: string,
    request: ExpressInterestRequest,
  ): Promise<InterestRecord> {
    const project = await this.projects.findProject(projectId);
    if (!project || project.deletedAt || project.moderationStatus !== 'visible') {
      throw new DomainError('PROJECTS_NOT_FOUND', 'Project not found');
    }
    if (!isPublished(project)) {
      throw new DomainError('PROJECTS_NOT_OPEN', 'The project is not published');
    }
    if (request.indicativeAmount) assertCurrency(request.indicativeAmount.currency);
    const interest: InterestRecord = {
      id: this.ids.next(),
      projectId,
      userId,
      kind: request.kind,
      message: request.message,
      indicativeAmountMinor: request.indicativeAmount
        ? BigInt(request.indicativeAmount.amountMinor)
        : null,
      indicativeCurrency: request.indicativeAmount?.currency ?? null,
      documentMediaIds: request.documentMediaIds ?? [],
      createdAt: this.clock.now(),
    };
    await this.transactions.run(async () => {
      await this.projects.insertInterest(interest);
      for (const mediaId of interest.documentMediaIds) {
        await this.media.attach({
          mediaId,
          ownerId: userId,
          usage: 'project_interest_document',
          resource: { type: PROJECT_INTEREST_RESOURCE, id: interest.id },
        });
      }
      await this.events.record(InterestExpressed, projectId, {
        interestId: interest.id,
        userId,
        kind: interest.kind,
      });
    });
    return interest;
  }
}
