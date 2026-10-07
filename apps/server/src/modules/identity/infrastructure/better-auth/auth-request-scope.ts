import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ErrorReporter } from '../../../../platform/observability';

/** State of one /v1/auth request, shared by the Better Auth hooks of that request. */
export interface AuthRequestState {
  /** Better Auth path, relative to /v1/auth (for example `/callback/google`). */
  readonly path: string;
  /** Work to run once the response is sent (emails). */
  readonly afterResponse: (() => Promise<void>)[];
  /** Users created by this request: their first account and session are not "new". */
  readonly registeredUserIds: Set<string>;
  /** Events already recorded by this request, for writes that Better Auth may repeat. */
  readonly emitted: Set<string>;
}

/**
 * Request-scoped state for the Better Auth handler (AsyncLocalStorage). Emails are deferred
 * until after the response, so that they are never sent for a failed request and so that
 * response times do not reveal whether an email was sent (account enumeration).
 */
@Injectable()
export class AuthRequestScope implements OnApplicationShutdown {
  private readonly logger = new Logger(AuthRequestScope.name);
  private readonly storage = new AsyncLocalStorage<AuthRequestState>();
  private readonly inFlight = new Set<Promise<void>>();

  constructor(private readonly errorReporter: ErrorReporter) {}

  run<T>(state: AuthRequestState, work: () => Promise<T>): Promise<T> {
    return this.storage.run(state, work);
  }

  current(): AuthRequestState | undefined {
    return this.storage.getStore();
  }

  static newState(path: string): AuthRequestState {
    return { path, afterResponse: [], registeredUserIds: new Set(), emitted: new Set() };
  }

  /** Runs `task` after the response, or immediately outside of an auth request. */
  async defer(task: () => Promise<void>): Promise<void> {
    const state = this.current();
    if (state) {
      state.afterResponse.push(task);
      return;
    }
    await task();
  }

  /** Runs deferred work in the background; failures are logged and reported, never thrown. */
  flush(state: AuthRequestState): void {
    for (const task of state.afterResponse.splice(0)) {
      const running = task()
        .catch((error: unknown) => {
          this.logger.error(error);
          this.errorReporter.capture(error);
        })
        .finally(() => this.inFlight.delete(running));
      this.inFlight.add(running);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }
}
