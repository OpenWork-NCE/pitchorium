/** BullMQ queue of the content module (worker): link previews and scheduled tasks. */
export const CONTENT_QUEUE = 'content.processing';

export const CONTENT_JOBS = {
  linkPreview: 'link-preview',
  consolidateViews: 'consolidate-post-views',
} as const;

export interface LinkPreviewJobData {
  postId: string;
}
