import type { ErrorCode } from '@pitchorium/contracts';

/**
 * Expected business failure. The HTTP layer maps `code` to a status through the contracts
 * registry; `message` is a technical English sentence that clients must not display.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}
