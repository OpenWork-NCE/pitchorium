import { Injectable } from '@nestjs/common';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { MediaReady } from '../../media';
import { ProfilesService } from '../application/profiles.service';
import { ProfileCreated } from '../domain/profile-events';

/** A new profile with a provider photo asks the media module to import it (worker). */
@Injectable()
@DomainEventHandler({ name: 'profiles.import-provider-photo', eventTypes: [ProfileCreated.TYPE] })
export class ProviderPhotoImportHandler implements DomainEventSubscriber {
  constructor(private readonly profiles: ProfilesService) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    await this.profiles.importProviderPhoto(event.aggregateId);
  }
}

/** Shows the imported provider photo once the media module has processed it (worker). */
@Injectable()
@DomainEventHandler({ name: 'profiles.use-imported-avatar', eventTypes: [MediaReady.TYPE] })
export class ImportedAvatarHandler implements DomainEventSubscriber {
  constructor(private readonly profiles: ProfilesService) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const { source, usage, ownerId } = event.payload;
    if (source !== 'import' || usage !== 'avatar' || typeof ownerId !== 'string') return;
    await this.profiles.useImportedAvatar(ownerId, event.aggregateId);
  }
}
