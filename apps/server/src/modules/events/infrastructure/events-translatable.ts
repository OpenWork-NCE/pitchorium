import { Injectable, type OnModuleInit } from '@nestjs/common';
import { LocalizationFacade } from '../../localization';
import { EventReadsService } from '../application/event-reads.service';
import { EventsRepository } from '../application/ports';

/** Title and description of an event the reader sees, for the translation on demand (§8.3). */
@Injectable()
export class EventsTranslatable implements OnModuleInit {
  constructor(
    private readonly localization: LocalizationFacade,
    private readonly events: EventsRepository,
    private readonly reads: EventReadsService,
  ) {}

  onModuleInit(): void {
    this.localization.registerTranslatableSource({
      type: 'event',
      read: async (id, readerId) => {
        const event = await this.events.findEvent(id);
        if (!event || !(await this.reads.canSee(event, { kind: 'member', viewerId: readerId }))) {
          return null;
        }
        return {
          key: event.id,
          fields: { title: event.title, description: event.description },
          language: event.language,
        };
      },
    });
  }
}
