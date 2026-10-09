import { describe, expect, it } from 'vitest';
import { initialVisibility, visibilityOptions } from './visibility';

const available = (options: ReturnType<typeof visibilityOptions>) =>
  options.filter((option) => !option.disabled).map((option) => option.value);

describe('audiences of the composer', () => {
  it('offers public only with a public page, and says why otherwise', () => {
    expect(available(visibilityOptions({ publicPageEnabled: true }))).toEqual([
      'public',
      'members',
      'connections',
    ]);
    const closed = visibilityOptions({ publicPageEnabled: false });
    expect(closed[0]).toEqual({ value: 'public', disabled: true, reason: 'publicPageDisabled' });
    expect(initialVisibility(closed)).toBe('members');
  });

  it('never widens the audience of a reposted publication', () => {
    expect(
      available(
        visibilityOptions({
          publicPageEnabled: true,
          original: { visibility: 'public', byReader: false },
        }),
      ),
    ).toEqual(['public', 'members', 'connections']);
    expect(
      available(
        visibilityOptions({
          publicPageEnabled: true,
          original: { visibility: 'members', byReader: false },
        }),
      ),
    ).toEqual(['members', 'connections']);
    expect(
      available(
        visibilityOptions({
          publicPageEnabled: true,
          original: { visibility: 'connections', byReader: false },
        }),
      ),
    ).toEqual([]);
    const own = visibilityOptions({
      publicPageEnabled: true,
      original: { visibility: 'connections', byReader: true },
    });
    expect(available(own)).toEqual(['connections']);
    expect(initialVisibility(own)).toBe('connections');
  });
});
