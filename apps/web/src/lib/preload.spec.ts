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
