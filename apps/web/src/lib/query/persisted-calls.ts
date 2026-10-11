/**
 * The calls of the api of the persisted mutations (persisted-mutations.ts), loaded with the first
 * of them or when the page is idle: the member frame, which registers them, does not carry the
 * tags of the api they belong to in its first load (ADR 0094).
 */
export {
  commentsControllerCreate,
  messagingControllerSend,
  postsControllerReact,
  postsControllerUnreact,
} from '@pitchorium/api-client';
