import type { MediaRejectionReason, MediaUsage, MediaVisibility } from '@pitchorium/contracts';
import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';
import type { MediaSource } from './media-asset';

const AGGREGATE = 'media_asset';

/** An upload URL was issued, or an import from a provider URL was requested. */
export class MediaRequested extends DomainEvent<{
  usage: MediaUsage;
  source: MediaSource;
  ownerId: string;
}> {
  static readonly TYPE = 'media.asset.requested.v1';
  readonly type = MediaRequested.TYPE;
  readonly aggregateType = AGGREGATE;

  constructor(props: DomainEventProps<MediaRequested['payload']>) {
    super(props);
  }
}

/** Internal to the media module: the client confirmed its upload, processing must start. */
export class MediaUploaded extends DomainEvent<{ usage: MediaUsage }> {
  static readonly TYPE = 'media.asset.uploaded.v1';
  readonly type = MediaUploaded.TYPE;
  readonly aggregateType = AGGREGATE;

  constructor(props: DomainEventProps<MediaUploaded['payload']>) {
    super(props);
  }
}

export class MediaReady extends DomainEvent<{
  usage: MediaUsage;
  source: MediaSource;
  ownerId: string;
}> {
  static readonly TYPE = 'media.asset.ready.v1';
  readonly type = MediaReady.TYPE;
  readonly aggregateType = AGGREGATE;

  constructor(props: DomainEventProps<MediaReady['payload']>) {
    super(props);
  }
}

export class MediaRejected extends DomainEvent<{
  usage: MediaUsage;
  source: MediaSource;
  ownerId: string;
  reason: MediaRejectionReason;
}> {
  static readonly TYPE = 'media.asset.rejected.v1';
  readonly type = MediaRejected.TYPE;
  readonly aggregateType = AGGREGATE;

  constructor(props: DomainEventProps<MediaRejected['payload']>) {
    super(props);
  }
}

export class MediaDeleted extends DomainEvent<{
  usage: MediaUsage;
  ownerId: string;
  reason: 'owner_request' | 'orphan_cleanup';
}> {
  static readonly TYPE = 'media.asset.deleted.v1';
  readonly type = MediaDeleted.TYPE;
  readonly aggregateType = AGGREGATE;

  constructor(props: DomainEventProps<MediaDeleted['payload']>) {
    super(props);
  }
}

/**
 * Internal to the media module: the files must move to the bucket of the new visibility of
 * their resource; the worker copies them, then deletes the source (ADR 0026).
 */
export class MediaVisibilityRequested extends DomainEvent<{ visibility: MediaVisibility }> {
  static readonly TYPE = 'media.asset.visibility-requested.v1';
  readonly type = MediaVisibilityRequested.TYPE;
  readonly aggregateType = AGGREGATE;

  constructor(props: DomainEventProps<MediaVisibilityRequested['payload']>) {
    super(props);
  }
}
