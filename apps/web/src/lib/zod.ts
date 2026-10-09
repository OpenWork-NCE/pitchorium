import { config } from 'zod/v4/core';

/**
 * Zod probes `new Function()` when it builds an object schema, to compile its parser: the CSP
 * forbids eval (ADR 0088), so the probe would only raise a violation report. Turned off before
 * any schema exists: first import of src/lib/env.ts on the server, and of
 * src/instrumentation-client.ts, which Next.js runs before the code of the app in the browser.
 * Only the configuration of the core is imported: Zod itself stays out of the first load.
 */
config({ jitless: true });
