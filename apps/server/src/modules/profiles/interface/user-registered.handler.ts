import { Injectable } from '@nestjs/common';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { UserRegistered } from '../../identity';
import { ProfilesService } from '../application/profiles.service';

/** Creates the base profile of a new account (worker). Replays are no-ops. */
@Injectable()
@DomainEventHandler({ name: 'profiles.create-base-profile', eventTypes: [UserRegistered.TYPE] })
export class UserRegisteredHandler implements DomainEventSubscriber {
  constructor(private readonly profiles: ProfilesService) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    await this.profiles.ensureProfile(event.aggregateId);
  }
}
