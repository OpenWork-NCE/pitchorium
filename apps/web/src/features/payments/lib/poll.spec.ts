import { describe, expect, it, vi } from 'vitest';
import { createPoller, type PollClock, type PollVisibility } from './poll';

/** A clock and a visibility the test drives by hand. */
function harness() {
  let now = 0;
  let timers: { at: number; callback: () => void; id: number }[] = [];
  let nextId = 1;
  const clock: PollClock = {
    now: () => now,
    setTimeout: (callback, ms) => {
      const id = nextId++;
      timers.push({ at: now + ms, callback, id });
      return id;
    },
    clearTimeout: (handle) => {
      timers = timers.filter((timer) => timer.id !== handle);
    },
  };
  let hidden = false;
  const listeners = new Set<() => void>();
  const visibility: PollVisibility = {
    hidden: () => hidden,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  return {
    clock,
    visibility,
    /** Moves the time on, running the timers due, and lets their reads settle. */
    async advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const due = timers.filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers = timers.filter((timer) => timer !== due);
        now = due.at;
        due.callback();
        await Promise.resolve();
        await Promise.resolve();
      }
      now = target;
    },
    async setHidden(value: boolean) {
      hidden = value;
      for (const listener of listeners) listener();
      await Promise.resolve();
      await Promise.resolve();
    },
    pending: () => timers.length,
  };
}

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('createPoller', () => {
  it('reads at once, then at each interval, and stops on a final value', async () => {
    const h = harness();
    const values = ['pending_payment', 'pending_payment', 'succeeded'];
    const read = vi.fn(() => Promise.resolve(values.shift()!));
    const onValue = vi.fn();
    const poller = createPoller({
      read,
      done: (value) => value === 'succeeded',
      fatal: () => false,
      onValue,
      onError: vi.fn(),
      onTimeout: vi.fn(),
      intervalMs: 3000,
      maxDurationMs: 60_000,
      clock: h.clock,
      visibility: h.visibility,
    });
    poller.start();
    await settle();
    expect(read).toHaveBeenCalledTimes(1);
    await h.advance(3000);
    expect(read).toHaveBeenCalledTimes(2);
    await h.advance(3000);
    expect(onValue).toHaveBeenLastCalledWith('succeeded');
    expect(poller.state).toBe('done');
    await h.advance(30_000);
    expect(read).toHaveBeenCalledTimes(3);
    expect(h.pending()).toBe(0);
  });

  it('pauses while the tab is hidden, without counting that time, and reads at once on return', async () => {
    const h = harness();
    const read = vi.fn(() => Promise.resolve('pending_payment'));
    const onTimeout = vi.fn();
    const poller = createPoller({
      read,
      done: () => false,
      fatal: () => false,
      onValue: vi.fn(),
      onError: vi.fn(),
      onTimeout,
      intervalMs: 3000,
      maxDurationMs: 10_000,
      clock: h.clock,
      visibility: h.visibility,
    });
    poller.start();
    await settle();
    await h.advance(3000);
    expect(read).toHaveBeenCalledTimes(2);
    await h.setHidden(true);
    expect(poller.state).toBe('paused');
    await h.advance(600_000);
    expect(read).toHaveBeenCalledTimes(2);
    expect(onTimeout).not.toHaveBeenCalled();
    await h.setHidden(false);
    expect(read).toHaveBeenCalledTimes(3);
    expect(poller.state).toBe('running');
  });

  it('gives up after the visible time, then starts again on demand', async () => {
    const h = harness();
    const read = vi.fn(() => Promise.resolve('pending_payment'));
    const onTimeout = vi.fn();
    const poller = createPoller({
      read,
      done: () => false,
      fatal: () => false,
      onValue: vi.fn(),
      onError: vi.fn(),
      onTimeout,
      intervalMs: 3000,
      maxDurationMs: 9000,
      clock: h.clock,
      visibility: h.visibility,
    });
    poller.start();
    await settle();
    await h.advance(20_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(poller.state).toBe('timed_out');
    const reads = read.mock.calls.length;
    await h.advance(20_000);
    expect(read).toHaveBeenCalledTimes(reads);
    poller.start();
    await settle();
    expect(read).toHaveBeenCalledTimes(reads + 1);
    expect(poller.state).toBe('running');
  });

  it('retries a network failure and stops on a refusal that reading again cannot change', async () => {
    const h = harness();
    const network = new Error('network');
    const refused = new Error('404');
    const outcomes: (Error | string)[] = [network, refused];
    const read = vi.fn(() => {
      const next = outcomes.shift()!;
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    });
    const onError = vi.fn();
    const poller = createPoller({
      read,
      done: () => false,
      fatal: (error) => error === refused,
      onValue: vi.fn(),
      onError,
      onTimeout: vi.fn(),
      intervalMs: 3000,
      maxDurationMs: 60_000,
      clock: h.clock,
      visibility: h.visibility,
    });
    poller.start();
    await settle();
    expect(onError).toHaveBeenCalledWith(network);
    expect(poller.state).toBe('running');
    await h.advance(3000);
    expect(onError).toHaveBeenLastCalledWith(refused);
    expect(poller.state).toBe('failed');
    expect(h.pending()).toBe(0);
  });

  it('waits for the tab to be visible before the first reading', async () => {
    const h = harness();
    await h.setHidden(true);
    const read = vi.fn(() => Promise.resolve('pending_payment'));
    const poller = createPoller({
      read,
      done: () => false,
      fatal: () => false,
      onValue: vi.fn(),
      onError: vi.fn(),
      onTimeout: vi.fn(),
      intervalMs: 3000,
      maxDurationMs: 60_000,
      clock: h.clock,
      visibility: h.visibility,
    });
    poller.start();
    await settle();
    expect(read).not.toHaveBeenCalled();
    await h.setHidden(false);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('ignores a reading that answers after a stop', async () => {
    const h = harness();
    let answer: (value: string) => void = () => {};
    const read = vi.fn(() => new Promise<string>((resolve) => (answer = resolve)));
    const onValue = vi.fn();
    const poller = createPoller({
      read,
      done: () => false,
      fatal: () => false,
      onValue,
      onError: vi.fn(),
      onTimeout: vi.fn(),
      intervalMs: 3000,
      maxDurationMs: 60_000,
      clock: h.clock,
      visibility: h.visibility,
    });
    poller.start();
    poller.stop();
    answer('succeeded');
    await settle();
    expect(onValue).not.toHaveBeenCalled();
    expect(h.pending()).toBe(0);
  });
});
