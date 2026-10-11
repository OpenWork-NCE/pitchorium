import {
  CONVERSATION_SEARCH_MAX_LENGTH,
  INTRODUCTION_NOTE_MAX_LENGTH,
  MESSAGE_ATTACHMENT_TEXT_MAX_LENGTH,
  MESSAGE_ATTACHMENTS_MAX,
  MESSAGE_BODY_MAX_LENGTH,
} from '@pitchorium/contracts';
import { expect, it } from 'vitest';
import { MESSAGING_LIMITS } from './limits';

it('keeps the limits of the messaging forms equal to the contracts', () => {
  expect(MESSAGING_LIMITS).toEqual({
    body: MESSAGE_BODY_MAX_LENGTH,
    attachments: MESSAGE_ATTACHMENTS_MAX,
    attachmentText: MESSAGE_ATTACHMENT_TEXT_MAX_LENGTH,
    introductionNote: INTRODUCTION_NOTE_MAX_LENGTH,
    search: CONVERSATION_SEARCH_MAX_LENGTH,
  });
});
