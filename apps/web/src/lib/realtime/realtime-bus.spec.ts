import { CLIENT_EVENTS, SERVER_EVENTS } from '@pitchorium/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  dispatchRealtime,
  emitRealtime,
  onRealtime,
  REALTIME_EVENTS,
  setRealtimeSender,
} from './realtime-bus';

describe('realtime bus', () => {
  it('names the events of the api as the contracts do', () => {
    expect(REALTIME_EVENTS).toEqual(SERVER_EVENTS);
    expect(REALTIME_EVENTS.typing).toBe(CLIENT_EVENTS.typing);
  });

  it('gives an event to its listeners until they stop', () => {
    const heard = vi.fn();
    const stop = onRealtime('counters', heard);
    dispatchRealtime('counters', { n: 1 });
    stop();
    dispatchRealtime('counters', { n: 2 });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('sends nothing while the channel is closed', () => {
    const emit = vi.fn();
    expect(emitRealtime('messaging:typing', {})).toBe(false);
    setRealtimeSender({ emit });
    expect(emitRealtime('messaging:typing', { conversationId: 'c' })).toBe(true);
    expect(emit).toHaveBeenCalledWith('messaging:typing', { conversationId: 'c' });
    setRealtimeSender(null);
  });
});
