/** BullMQ queue of the media module (worker): processing and scheduled tasks. */
export const MEDIA_QUEUE = 'media.processing';

export const MEDIA_JOBS = {
  process: 'process',
  move: 'move',
  deleteOrphans: 'delete-orphans',
  purgeDeleted: 'purge-deleted',
} as const;

export interface ProcessJobData {
  mediaId: string;
}

export type MoveJobData = ProcessJobData;
