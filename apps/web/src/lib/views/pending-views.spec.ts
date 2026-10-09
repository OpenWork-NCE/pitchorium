import { describe, expect, it, vi } from 'vitest';
import { registerPendingViews, sendPendingViews } from './pending-views';

describe('views pending at the sign-out', () => {
  it('are sent and answered, then stopped, before the session ends', async () => {
    const order: string[] = [];
    const remove = registerPendingViews({
      send: async () => {
        await Promise.resolve();
        order.push('sent');
      },
      stop: () => order.push('stopped'),
    });
    await sendPendingViews();
    expect(order).toEqual(['sent', 'stopped']);
    remove();
  });

  it('forgets a page that left', async () => {
    const send = vi.fn(() => Promise.resolve());
    registerPendingViews({ send, stop: vi.fn() })();
    await sendPendingViews();
    expect(send).not.toHaveBeenCalled();
  });
});
