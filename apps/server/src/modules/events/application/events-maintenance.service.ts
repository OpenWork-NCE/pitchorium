import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { EventCompleted } from '../domain/event-events';
import { EventEventsRecorder } from './event-events.recorder';
import { EventsRepository } from './ports';

const BATCH = 200;

/** Scheduled task: a published event whose end has passed becomes `completed`. */
@Injectable()
export class EventsMaintenanceService {
  constructor(
    private readonly events: EventsRepository,
    private readonly recorder: EventEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async completeEnded(): Promise<number> {
    let completed = 0;
    for (;;) {
      const now = this.clock.now();
      const ended = await this.events.endedBefore(now, BATCH);
      for (const candidate of ended) {
        await this.transactions.run(async () => {
          const event = await this.events.lockEvent(candidate.id);
          if (!event || event.status !== 'published' || event.endsAt > now) return;
          await this.events.updateEvent(event.id, {
            status: 'completed',
            completedAt: now,
            updatedAt: now,
          });
          await this.recorder.record(EventCompleted, event.id, {});
          completed += 1;
        });
      }
      if (ended.length < BATCH) return completed;
    }
  }
}
