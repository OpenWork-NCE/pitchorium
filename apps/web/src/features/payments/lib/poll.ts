/**
 * Reading of the state of a contribution after the return from the provider (ADR 0137): the
 * address of return proves nothing, only the api says the payment is final. The poller reads at
 * a steady interval while the tab is visible, pauses while it is hidden (no reading the person
 * cannot see), and gives up after a time counted while visible; it can be started again.
 */
export interface PollClock {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

export interface PollVisibility {
  hidden: () => boolean;
  /** Calls back on each change of visibility; returns the unsubscription. */
  subscribe: (callback: () => void) => () => void;
}

export interface PollOptions<T> {
  read: () => Promise<T>;
  /** A final value: the poller stops on it. */
  done: (value: T) => boolean;
  /** An error after which reading again is pointless (a 4xx); others are retried. */
  fatal: (error: unknown) => boolean;
  onValue: (value: T) => void;
  onError: (error: unknown) => void;
  /** The time is over while the payment is still pending. */
  onTimeout: () => void;
  intervalMs: number;
  /** Visible time after which the poller stops. */
  maxDurationMs: number;
  clock?: PollClock;
  visibility?: PollVisibility;
}

/** Every 3 seconds, for 2 minutes of visible time (Stripe and Flutterwave notify in seconds). */
export const RETURN_POLL_INTERVAL_MS = 3_000;
export const RETURN_POLL_MAX_MS = 120_000;

export type PollState = 'idle' | 'running' | 'paused' | 'done' | 'timed_out' | 'failed';

const browserClock: PollClock = {
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
  now: () => Date.now(),
};

const browserVisibility: PollVisibility = {
  hidden: () => document.visibilityState === 'hidden',
  subscribe: (callback) => {
    document.addEventListener('visibilitychange', callback);
    return () => document.removeEventListener('visibilitychange', callback);
  },
};

export function createPoller<T>(options: PollOptions<T>) {
  const clock = options.clock ?? browserClock;
  const visibility = options.visibility ?? browserVisibility;
  let state: PollState = 'idle';
  let timer: unknown = null;
  /** Visible time spent so far, and the start of the current visible stretch. */
  let spent = 0;
  let since = 0;
  let unsubscribe: (() => void) | null = null;
  let generation = 0;

  const elapsed = () => spent + (state === 'running' ? clock.now() - since : 0);

  function clear() {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  }

  function finish(next: PollState) {
    clear();
    if (state === 'running') spent += clock.now() - since;
    state = next;
    unsubscribe?.();
    unsubscribe = null;
  }

  async function tick() {
    const current = generation;
    timer = null;
    let value: T;
    try {
      value = await options.read();
    } catch (error) {
      if (current !== generation || state !== 'running') return;
      options.onError(error);
      if (options.fatal(error)) return finish('failed');
      return schedule();
    }
    if (current !== generation || (state !== 'running' && state !== 'paused')) return;
    options.onValue(value);
    if (options.done(value)) return finish('done');
    if (state === 'running') schedule();
  }

  function schedule() {
    if (elapsed() >= options.maxDurationMs) {
      finish('timed_out');
      options.onTimeout();
      return;
    }
    timer = clock.setTimeout(() => void tick(), options.intervalMs);
  }

  function onVisibility() {
    if (visibility.hidden() && state === 'running') {
      clear();
      spent += clock.now() - since;
      state = 'paused';
    } else if (!visibility.hidden() && state === 'paused') {
      state = 'running';
      since = clock.now();
      // Back on the tab: read at once, the payment may have finished meanwhile.
      void tick();
    }
  }

  return {
    get state() {
      return state;
    },
    /** Starts, or starts again after a stop or the end of the time: reads at once. */
    start() {
      clear();
      generation += 1;
      spent = 0;
      unsubscribe?.();
      unsubscribe = visibility.subscribe(onVisibility);
      if (visibility.hidden()) {
        state = 'paused';
        return;
      }
      state = 'running';
      since = clock.now();
      void tick();
    },
    stop() {
      generation += 1;
      if (state === 'running' || state === 'paused') finish('idle');
    },
  };
}
