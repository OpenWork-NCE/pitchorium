/**
 * Keyboard shortcuts (ADR 0098): a binding is `mod+k` (Ctrl, or Cmd on Apple), `?`, or a
 * sequence of two keys `g h` (go to home). Single keys never fire while the person types in a
 * field; a combination with Ctrl or Cmd does.
 */

export interface Binding {
  /** `mod` is Ctrl, or Cmd on an Apple device. */
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

/** `mod+k`, `shift+?`, `g h` (a sequence: two bindings). */
export function parseBinding(text: string): Binding[] {
  return text.split(' ').map((part) => {
    const keys = part.toLowerCase().split('+');
    const key = keys.at(-1) ?? '';
    return {
      mod: keys.includes('mod'),
      shift: keys.includes('shift'),
      alt: keys.includes('alt'),
      key,
    };
  });
}

/** An element where a typed letter is text, not a command. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (target as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
    type,
  );
}

export function isApple(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Does a key event match a binding (`mod` read as Cmd on Apple, Ctrl elsewhere)? */
export function matches(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
  binding: Binding,
  apple: boolean,
): boolean {
  const mod = apple ? event.metaKey : event.ctrlKey;
  if (binding.mod !== mod) return false;
  if (binding.alt !== event.altKey) return false;
  // `?` is typed with Shift on most layouts: Shift only counts for letters.
  if (/^[a-z]$/.test(binding.key) && binding.shift !== event.shiftKey) return false;
  return event.key.toLowerCase() === binding.key;
}

/** Keys of a binding as shown to a person: `Ctrl K`, `⌘ K`, `G H`. */
export function displayKeys(text: string, apple: boolean): string[] {
  return parseBinding(text).flatMap((binding) => [
    ...(binding.mod ? [apple ? '⌘' : 'Ctrl'] : []),
    ...(binding.alt ? [apple ? '⌥' : 'Alt'] : []),
    ...(binding.shift && /^[a-z]$/.test(binding.key) ? ['Shift'] : []),
    binding.key.length === 1 ? binding.key.toUpperCase() : binding.key,
  ]);
}
