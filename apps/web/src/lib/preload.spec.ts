// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadWhenIdle } from './preload';

const offline = (value: boolean) =>
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(!value);

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('preload once the page is idle', () => {
  it('loads at the idle moment', () => {
    vi.useFakeTimers();
    offline(false);
    const load = vi.fn(() => Promise.resolve());
    preloadWhenIdle(load);
    vi.runAllTimers();
    expect(load).toHaveBeenCalledOnce();
  });

  it('waits for the network when the page is offline, rather than fail', () => {
    vi.useFakeTimers();
    offline(true);
    const load = vi.fn(() => Promise.resolve());
    preloadWhenIdle(load);
    vi.runAllTimers();
    expect(load).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('online'));
    expect(load).toHaveBeenCalledOnce();
  });

  it('loads nothing once cancelled', () => {
    vi.useFakeTimers();
    offline(true);
    const load = vi.fn(() => Promise.resolve());
    const cancel = preloadWhenIdle(load);
    vi.runAllTimers();
    cancel();
    window.dispatchEvent(new Event('online'));
    expect(load).not.toHaveBeenCalled();
  });
});

describe('one preload per module, whatever the number of its components', () => {
  it('schedules one idle callback for the instances of a module, and loads it once', () => {
    vi.useFakeTimers();
    offline(false);
    const timers = vi.spyOn(window, 'setTimeout');
    const load = vi.fn(() => Promise.resolve());
    for (let index = 0; index < 50; index += 1) preloadWhenIdle(load);
    expect(timers).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(load).toHaveBeenCalledOnce();
    // Mounted later, the module already there: nothing more.
    preloadWhenIdle(load);
    vi.runAllTimers();
    expect(load).toHaveBeenCalledOnce();
  });

  it('keeps the preload while one of its components stays, cancels it with the last one', () => {
    vi.useFakeTimers();
    offline(false);
    const load = vi.fn(() => Promise.resolve());
    const first = preloadWhenIdle(load);
    const second = preloadWhenIdle(load);
    first();
    first();
    vi.runAllTimers();
    expect(load).toHaveBeenCalledOnce();

    const other = vi.fn(() => Promise.resolve());
    const one = preloadWhenIdle(other);
    const two = preloadWhenIdle(other);
    one();
    two();
    vi.runAllTimers();
    expect(other).not.toHaveBeenCalled();
    second();
  });

  it('preloads again after a failure', async () => {
    vi.useFakeTimers();
    offline(false);
    const load = vi.fn(() => Promise.reject(new Error('network')));
    preloadWhenIdle(load);
    vi.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();
    preloadWhenIdle(load);
    vi.runAllTimers();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('the network before a fetch of code', () => {
  it('resolves at once online, at the return of the network offline', async () => {
    const { whenOnline } = await import('./preload');
    offline(false);
    await expect(whenOnline()).resolves.toBeUndefined();
    offline(true);
    let done = false;
    const waiting = whenOnline().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    window.dispatchEvent(new Event('online'));
    await waiting;
    expect(done).toBe(true);
  });
});
