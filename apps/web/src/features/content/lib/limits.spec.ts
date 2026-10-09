import {
  COMMENT_TEXT_MAX_LENGTH,
  FEED_NEWER_CAP,
  POST_DOCUMENT_TITLE_MAX_LENGTH,
  POST_IMAGE_ALT_MAX_LENGTH,
  POST_MAX_IMAGES,
  POST_TEXT_MAX_LENGTH,
  POST_VIEWS_MAX_PER_SIGNAL,
} from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { LIMITS } from './limits';

describe('limits of the publications', () => {
  it('equal the contracts', () => {
    expect(LIMITS).toEqual({
      postText: POST_TEXT_MAX_LENGTH,
      commentText: COMMENT_TEXT_MAX_LENGTH,
      images: POST_MAX_IMAGES,
      imageAlt: POST_IMAGE_ALT_MAX_LENGTH,
      documentTitle: POST_DOCUMENT_TITLE_MAX_LENGTH,
      viewsPerSignal: POST_VIEWS_MAX_PER_SIGNAL,
      newerCap: FEED_NEWER_CAP,
    });
  });
});
