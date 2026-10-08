import { Injectable } from '@nestjs/common';
import { uuidV7Schema } from '@pitchorium/contracts';
import type { Request } from 'express';
import type { Principal, ProtectedResource, ResourceResolver } from '../../../platform/http';
import { EventReadsService } from '../application/event-reads.service';
import { EventsRepository } from '../application/ports';

/**
 * Resource of the `:eventId` routes: an event the principal may see, with the roles they hold
 * on it, `organizer` (its creator, or an owner or admin of its organization) and `attendee`
 * (registered). An event they may not see answers 404.
 */
@Injectable()
export class EventResolver implements ResourceResolver {
  constructor(
    private readonly events: EventsRepository,
    private readonly reads: EventReadsService,
  ) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['eventId']);
    if (!id.success) return null;
    const event = await this.events.findEvent(id.data);
    const reader = { kind: 'member' as const, viewerId: principal.userId };
    if (!event || !(await this.reads.canSee(event, reader))) return null;
    const [manager, registration] = await Promise.all([
      this.reads.canManage(event, principal.userId),
      this.events.findRegistration(event.id, principal.userId),
    ]);
    return {
      type: 'event',
      id: event.id,
      ownerId: event.organizerId,
      roles: [
        ...(manager ? ['organizer'] : []),
        ...(registration?.status === 'registered' ? ['attendee'] : []),
      ],
    };
  }
}
