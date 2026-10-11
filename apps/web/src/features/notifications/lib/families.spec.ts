import { NOTIFICATION_FAMILIES } from '@pitchorium/contracts';
import { expect, it } from 'vitest';
import { NOTIFICATION_FILTERS } from './families';

it('offers « all » then each family of the contracts', () => {
  expect(NOTIFICATION_FILTERS).toEqual(['all', ...NOTIFICATION_FAMILIES]);
});
