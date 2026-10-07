import { Injectable } from '@nestjs/common';
import type { MediaResourceRef } from '../domain/media-asset';
import type { MediaReadAuthorizer } from './ports';

/** Modules owning resources register here who may read the private files attached to them. */
@Injectable()
export class MediaReadRegistry {
  private readonly authorizers = new Map<string, MediaReadAuthorizer>();

  register(authorizer: MediaReadAuthorizer): void {
    for (const type of authorizer.resourceTypes) {
      if (this.authorizers.has(type)) {
        throw new Error(`Resource type ${type} already has a media read authorizer`);
      }
      this.authorizers.set(type, authorizer);
    }
  }

  /** Fails closed: a resource type without an authorizer is readable by nobody but the owner. */
  canRead(viewerId: string, resource: MediaResourceRef): Promise<boolean> {
    return (
      this.authorizers.get(resource.type)?.canRead(viewerId, resource) ?? Promise.resolve(false)
    );
  }
}
