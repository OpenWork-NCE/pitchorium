import { z } from 'zod';

export const healthCheckResultSchema = z.object({
  status: z.enum(['up', 'down']),
  latencyMs: z.number().int().nonnegative(),
});

export const healthResponseSchema = z
  .object({
    status: z.enum(['ok', 'error']),
    checks: z.record(z.string(), healthCheckResultSchema),
  })
  .meta({ id: 'HealthResponse' });

export type HealthCheckResult = z.infer<typeof healthCheckResultSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
