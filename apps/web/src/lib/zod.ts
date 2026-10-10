/** The global configuration Zod 4 shares between its copies, on `globalThis`. */
type ZodGlobal = typeof globalThis & { __zod_globalConfig?: { jitless?: boolean } };

/**
 * Zod probes `new Function()` when it builds an object schema, to compile its parser: the CSP
 * forbids eval (ADR 0088), so the probe would only raise a violation report. Turned off before
 * any schema exists: first import of src/lib/env.ts on the server, and of
 * src/instrumentation-client.ts, which Next.js runs before the code of the app in the browser.
 * Zod 4 keeps its configuration in `globalThis.__zod_globalConfig` (the object `config()` of
 * `zod/v4/core` writes to, created by whichever comes first): set here without importing Zod,
 * whose core would otherwise weigh 4 kB on every page (zod.spec.ts checks the two
 * orders).
 */
const holder = globalThis as ZodGlobal;
(holder.__zod_globalConfig ??= {}).jitless = true;

export {};
