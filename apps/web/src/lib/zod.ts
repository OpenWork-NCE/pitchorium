import { z } from 'zod';

/**
 * Zod probes `new Function()` to compile its parsers: the CSP forbids eval (ADR 0088), so the
 * probe would only raise a violation report. Imported first by src/lib/env.ts.
 */
z.config({ jitless: true });
