import { Injectable } from '@nestjs/common';
import { uuidV7Schema } from '@pitchorium/contracts';
import type { Request } from 'express';
import type { Principal, ProtectedResource, ResourceResolver } from '../../../platform/http';
import { TrustRepository } from '../application/ports';

/**
 * Resource of `/v1/me/moderation/decisions/:decisionId`: a decision concerning the principal
 * (`subject`); any other answers 404.
 */
@Injectable()
export class DecisionSubjectResolver implements ResourceResolver {
  constructor(private readonly trust: TrustRepository) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['decisionId']);
    if (!id.success) return null;
    const decision = await this.trust.findDecision(id.data);
    if (!decision || decision.subjectId !== principal.userId) return null;
    return {
      type: 'moderation_decision',
      id: decision.id,
      ownerId: decision.subjectId,
      roles: ['subject'],
    };
  }
}
