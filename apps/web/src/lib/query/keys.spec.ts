import { getNotificationsControllerCountersQueryKey } from '@pitchorium/api-client';
import { describe, expect, it } from 'vitest';
import { COUNTERS_QUERY_KEY } from './keys';

describe('query keys', () => {
  it('names the counters as the generated client does', () => {
    expect(COUNTERS_QUERY_KEY).toEqual(getNotificationsControllerCountersQueryKey());
  });
});
