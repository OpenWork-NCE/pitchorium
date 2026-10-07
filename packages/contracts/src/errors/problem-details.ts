import { z } from 'zod';
import { errorCodeSchema } from './error-codes.js';

export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

export const PROBLEM_TYPE_PREFIX = 'urn:pitchorium:problem:';

export const validationIssueSchema = z.object({
  /** JSON Pointer (RFC 6901) into the validated part of the request. */
  pointer: z.string(),
  /** Machine-readable issue code, for example "invalid_type" or "too_small". */
  code: z.string(),
});

/** RFC 9457 problem details, extended with a stable `code` and the request id. */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: errorCodeSchema,
  requestId: z.string().optional(),
  errors: z.array(validationIssueSchema).optional(),
  /** Elements to complete before retrying, with ACCESS_PREREQUISITES_MISSING. */
  missing: z.array(z.string()).optional(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
