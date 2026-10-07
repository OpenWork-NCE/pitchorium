import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

export interface RawHttpHandlerOptions {
  /** Mount path, including the global prefix, for example `/v1/auth`. */
  path: string;
}

/**
 * Marks a provider that serves a path itself, outside of Nest routing and before the body
 * parsers, because it needs the raw request stream (for example the Better Auth handler).
 */
export const RawHttpHandler = DiscoveryService.createDecorator<RawHttpHandlerOptions>();

export interface RawHttpRequestHandler {
  handle(request: IncomingMessage, response: ServerResponse): Promise<void>;
}

/** Must run before the body parsers are registered. */
export function mountRawHttpHandlers(app: INestApplication): void {
  const discovery = app.get(DiscoveryService);
  for (const wrapper of discovery.getProviders({ metadataKey: RawHttpHandler.KEY })) {
    const options = discovery.getMetadataByDecorator(RawHttpHandler, wrapper);
    if (!options) continue;
    const handler = wrapper.instance as RawHttpRequestHandler;
    app.use(
      options.path,
      (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => {
        handler.handle(request, response).catch(next);
      },
    );
  }
}

const MAX_BODY_BYTES = 1024 * 1024;

export class BodyTooLargeError extends Error {}

/** Reads the raw body of a webhook: signatures are computed on the exact bytes sent. */
export function readRawBody(request: IncomingMessage, limit = MAX_BODY_BYTES): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new BodyTooLargeError());
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}
