import { z } from 'zod';
import { type ErrorCode, errorCodes } from './error-codes.js';

/**
 * The stable codes as a schema, apart from their registry: reading or translating a code (the web
 * app on its authentication screens) does not load Zod (ADR 0094).
 */
export const errorCodeSchema = z.enum(Object.keys(errorCodes) as [ErrorCode, ...ErrorCode[]]);
