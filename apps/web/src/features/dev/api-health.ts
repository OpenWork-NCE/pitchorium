import '@/lib/zod';
import { type HealthResponse, healthResponseSchema } from '@pitchorium/contracts';

export interface ApiHealth {
  reachable: boolean;
  /** Body of `GET /v1/health/ready`, also when it answers 503. */
  health: HealthResponse | null;
  latencyMs: number;
}

export const apiHealthQueryKey = (origin: string) => ['dev', 'api-health', origin] as const;

/**
 * Readiness of the api with its checks. Plain fetch rather than the generated client: the
 * route answers 503 with the same body when a dependency is down, which is data here.
 */
export async function fetchApiHealth(origin: string, signal?: AbortSignal): Promise<ApiHealth> {
  const started = performance.now();
  try {
    const response = await fetch(`${origin}/v1/health/ready`, {
      cache: 'no-store',
      signal: signal ?? null,
    });
    const parsed = healthResponseSchema.safeParse(await response.json());
    return {
      reachable: true,
      health: parsed.success ? parsed.data : null,
      latencyMs: Math.round(performance.now() - started),
    };
  } catch {
    return { reachable: false, health: null, latencyMs: Math.round(performance.now() - started) };
  }
}
