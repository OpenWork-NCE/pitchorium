import type { IncomingMessage, ServerResponse } from 'node:http';
import { v7 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/** Reuses a well-formed incoming X-Request-Id (set by a proxy), otherwise generates one. */
export function resolveRequestId(request: IncomingMessage, response: ServerResponse): string {
  const incoming = request.headers[REQUEST_ID_HEADER];
  const id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : v7();
  response.setHeader(REQUEST_ID_HEADER, id);
  return id;
}
