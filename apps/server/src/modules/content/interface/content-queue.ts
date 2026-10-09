/** BullMQ queue of the content module (worker): link previews and scheduled tasks. */
export const CONTENT_QUEUE = 'content.processing';

export const CONTENT_JOBS = {
  linkPreview: 'link-preview',
  linkPreviewDraft: 'link-preview-draft',
  purgeLinkPreviews: 'purge-link-previews',
  consolidateViews: 'consolidate-post-views',
} as const;

export interface LinkPreviewJobData {
  postId: string;
}

export interface LinkPreviewDraftJobData {
  previewId: string;
}
