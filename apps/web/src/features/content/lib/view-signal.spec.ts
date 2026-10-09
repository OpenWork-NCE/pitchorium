import { describe, expect, it, vi } from 'vitest';
import { createViewSignal, FLUSH_DELAY_MS } from './view-signal';

function manualClock() {
  const timers: { run: () => void; delay: number }[] = [];
  return {
    timers,
    schedule: (run: () => void, delay: number) => {
      const timer = { run, delay };
      timers.push(timer);
      return () => timers.splice(timers.indexOf(timer), 1);
    },
    tick: () => timers.splice(0).forEach((timer) => timer.run()),
  };
}

describe('grouped signal of the publications seen', () => {
  it('sends the publications seen together, once each, after the delay', () => {
    const send = vi.fn();
    const clock = manualClock();
    const signal = createViewSignal(send, clock.schedule);
    signal.seen('a');
    signal.seen('b');
    signal.seen('a');
    expect(send).not.toHaveBeenCalled();
    expect(clock.timers).toHaveLength(1);
    expect(clock.timers[0]?.delay).toBe(FLUSH_DELAY_MS);
    clock.tick();
    expect(send).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
    // Seen again later in the same page: already counted.
    signal.seen('a');
    clock.tick();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends at once what waits when the page is left, in groups the api accepts', () => {
    const send = vi.fn();
    const signal = createViewSignal(send, manualClock().schedule);
    for (let index = 0; index < 120; index += 1) signal.seen(`post-${index}`);
    signal.flush();
    expect(send.mock.calls.map(([ids]) => (ids as string[]).length)).toEqual([50, 50, 20]);
  });

  it('forgets what waits when disposed', () => {
    const send = vi.fn();
    const clock = manualClock();
    const signal = createViewSignal(send, clock.schedule);
    signal.seen('a');
    signal.dispose();
    signal.flush();
    expect(send).not.toHaveBeenCalled();
  });

  it('signals nothing more once disposed', () => {
    const send = vi.fn();
    const signal = createViewSignal(send, () => () => undefined);
    signal.dispose();
    signal.seen('a');
    signal.flush();
    expect(send).not.toHaveBeenCalled();
  });
});
