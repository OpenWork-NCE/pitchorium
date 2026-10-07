import { Inject, Injectable, Logger } from '@nestjs/common';
import type { HealthCheckResult, HealthResponse } from '@pitchorium/contracts';

export type HealthCheck = () => Promise<unknown>;
export const HEALTH_CHECKS = Symbol('HEALTH_CHECKS');

const CHECK_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(HEALTH_CHECKS) private readonly checks: Record<string, HealthCheck>) {}

  live(): HealthResponse {
    return { status: 'ok', checks: {} };
  }

  /** Failure reasons are logged, never returned: the endpoint is public. */
  async ready(): Promise<HealthResponse> {
    const entries = await Promise.all(
      Object.entries(this.checks).map(
        async ([name, check]): Promise<[string, HealthCheckResult]> => {
          const startedAt = performance.now();
          try {
            await withTimeout(check(), CHECK_TIMEOUT_MS);
            return [name, { status: 'up', latencyMs: Math.round(performance.now() - startedAt) }];
          } catch (error) {
            this.logger.warn({ err: error }, `Health check ${name} failed`);
            return [name, { status: 'down', latencyMs: Math.round(performance.now() - startedAt) }];
          }
        },
      ),
    );
    const checks = Object.fromEntries(entries);
    const status = entries.every(([, result]) => result.status === 'up') ? 'ok' : 'error';
    return { status, checks };
  }
}
