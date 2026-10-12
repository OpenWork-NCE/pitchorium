// The clock of the stub api, of the server of the pages and of the browser (ADR 0171): the three
// start at the same fixed date and flow with the real time, so that a date the stub gives and the
// date a page compares it with tell the same story at every run (no « jusqu'au 7 octobre 2036 »
// to stay ahead of the real time).

/** The fixed date every journey and review capture starts at. */
export const STUB_EPOCH = Date.parse('2026-10-10T09:00:00.000Z');

/** Without a shared start (the stub api served alone), the clock starts with the process. */
const processStart = Date.now();

/** The real instant mapped to STUB_EPOCH, shared by every process of a run (`stubClockEnv`). */
function start() {
  return Number(process.env.STUB_CLOCK_START) || processStart;
}

/** The current instant on the clock of the stub, in milliseconds. */
export function stubNow() {
  return STUB_EPOCH + (Date.now() - start());
}

/** The current instant on the clock of the stub, as an ISO string. */
export function stubIso(offsetMs = 0) {
  return new Date(stubNow() + offsetMs).toISOString();
}

/**
 * The environment of the servers of a run: the shared start, set once by the configuration of
 * Playwright (its workers inherit it), and the preload that sets the clock of the server of the
 * pages (stub-clock.cjs). The relative path is the one of `apps/web`, where the servers start.
 */
export function stubClockEnv() {
  process.env.STUB_CLOCK_START ??= String(Date.now());
  return {
    STUB_CLOCK_START: process.env.STUB_CLOCK_START,
    STUB_CLOCK_EPOCH: String(STUB_EPOCH),
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ./e2e/support/stub-clock.cjs`.trim(),
  };
}
