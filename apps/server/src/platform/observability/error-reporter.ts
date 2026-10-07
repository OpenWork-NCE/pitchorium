import * as Sentry from '@sentry/node';

/** Port for reporting unexpected errors. Sentry is used only when SENTRY_DSN is set. */
export abstract class ErrorReporter {
  abstract capture(error: unknown): void;
}

export class SentryErrorReporter extends ErrorReporter {
  capture(error: unknown): void {
    Sentry.captureException(error);
  }
}

export class NoopErrorReporter extends ErrorReporter {
  capture(): void {}
}
