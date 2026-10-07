import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue';
import { DomainEventDispatcher } from './domain-event-dispatcher';
import type { OutboxEnvelope } from './outbox-envelope';

@Processor(QUEUE_NAMES.domainEvents, { concurrency: 10 })
export class DomainEventsProcessor extends WorkerHost {
  constructor(private readonly dispatcher: DomainEventDispatcher) {
    super();
  }

  async process(job: Job<OutboxEnvelope>): Promise<void> {
    await this.dispatcher.dispatch(job.data);
  }
}
