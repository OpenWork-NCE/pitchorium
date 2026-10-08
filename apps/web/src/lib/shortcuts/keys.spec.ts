// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { displayKeys, isTypingTarget, matches, parseBinding } from './keys';

const key = (init: Partial<KeyboardEvent> & { key: string }) => ({
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...init,
});

describe('keyboard shortcuts', () => {
  it('reads combinations and sequences', () => {
    expect(parseBinding('mod+k')).toEqual([{ mod: true, shift: false, alt: false, key: 'k' }]);
    expect(parseBinding('g h')).toHaveLength(2);
  });

  it('reads mod as Cmd on Apple devices and Ctrl elsewhere', () => {
    const [binding] = parseBinding('mod+k');
    expect(matches(key({ key: 'k', metaKey: true }), binding!, true)).toBe(true);
    expect(matches(key({ key: 'k', ctrlKey: true }), binding!, true)).toBe(false);
    expect(matches(key({ key: 'k', ctrlKey: true }), binding!, false)).toBe(true);
    expect(matches(key({ key: 'K', ctrlKey: true }), binding!, false)).toBe(true);
  });

  it('accepts ? whatever the Shift key', () => {
    const [binding] = parseBinding('?');
    expect(matches(key({ key: '?', shiftKey: true }), binding!, false)).toBe(true);
  });

  it('knows the fields where letters are text', () => {
    const input = document.createElement('input');
    const checkbox = Object.assign(document.createElement('input'), { type: 'checkbox' });
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(checkbox)).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
  });

  it('shows the keys of the platform', () => {
    expect(displayKeys('mod+k', false)).toEqual(['Ctrl', 'K']);
    expect(displayKeys('mod+k', true)).toEqual(['⌘', 'K']);
    expect(displayKeys('g h', false)).toEqual(['G', 'H']);
  });
});
