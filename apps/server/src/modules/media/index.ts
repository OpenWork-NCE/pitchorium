/** Public facade of the media module: the only file other modules may import. */
export {
  type AttachRequest,
  MediaFacade,
  type MediaImage,
  type MediaSummary,
} from './application/media.facade';
export type { MediaReadAuthorizer } from './application/ports';
export type { MediaResourceRef } from './domain/media-asset';
export { MediaDeleted, MediaReady, MediaRejected, MediaRequested } from './domain/media-events';
export { MediaModule } from './media.module';
