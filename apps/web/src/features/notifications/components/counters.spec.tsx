// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCounters } from './counters';

const counters = vi.hoisted(() => vi.fn());
vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  notificationsControllerCounters: counters,
}));

const KEY = ['/v1/me/counters'];
const of = (notifications: number) => ({ notifications, messages: 0, invitations: 0 });

function setup(initial: ReturnType<typeof of> | null) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useCounters(initial as never), { wrapper }) };
}

afterEach(() => counters.mockReset());

describe('useCounters', () => {
  it('starts from the counters of the server, without a request', () => {
    const { result } = setup(of(3));
    expect(result.current.data).toEqual(of(3));
    expect(counters).not.toHaveBeenCalled();
  });

  it('follows what the realtime channel writes in the cache', () => {
    const { result, queryClient } = setup(of(3));
    act(() => {
      queryClient.setQueryData(KEY, of(4));
    });
    expect(result.current.data).toEqual(of(4));
  });

  it('reads the counters again once invalidated, once for every reader', async () => {
    counters.mockResolvedValue(of(0));
    const { result, queryClient } = setup(of(3));
    renderHook(() => useCounters(null), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    await act(() => queryClient.invalidateQueries({ queryKey: KEY }));
    await waitFor(() => expect(result.current.data).toEqual(of(0)));
    expect(counters).toHaveBeenCalledTimes(1);
  });

  it('reads them when nothing is known yet', async () => {
    counters.mockResolvedValue(of(2));
    const { result } = setup(null);
    await waitFor(() => expect(result.current.data).toEqual(of(2)));
  });

  it('never lets the cache forget them', () => {
    const { queryClient } = setup(of(3));
    expect(queryClient.getQueryCache().find({ queryKey: KEY })?.gcTime).toBe(Infinity);
  });
});
