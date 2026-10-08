'use client';

import { useTranslations } from 'next-intl';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { displayKeys, isApple, isTypingTarget, matches, parseBinding } from '@/lib/shortcuts/keys';
import { Dialog, DialogContent } from './dialog';
import { Kbd } from './kbd';

export interface ShortcutDefinition {
  /** `mod+k`, `?`, `g h` (lib/shortcuts/keys.ts). */
  keys: string;
  /** What it does, shown in the help. */
  label: string;
  /** Group of the help ("Général", "Navigation"). */
  group: string;
  run: () => void;
}

interface Registry {
  register: (definition: ShortcutDefinition) => () => void;
  /** Same array until a shortcut is added or removed (a snapshot for useSyncExternalStore). */
  list: () => readonly ShortcutDefinition[];
  subscribe: (listener: () => void) => () => void;
}

const NONE: readonly ShortcutDefinition[] = [];

/** The shortcuts of a shell, outside React: an external store read by useSyncExternalStore. */
function createRegistry(): Registry {
  const definitions = new Set<ShortcutDefinition>();
  const listeners = new Set<() => void>();
  let snapshot: readonly ShortcutDefinition[] = NONE;
  const changed = () => {
    snapshot = [...definitions];
    for (const listener of listeners) listener();
  };
  return {
    register(definition) {
      definitions.add(definition);
      changed();
      return () => {
        definitions.delete(definition);
        changed();
      };
    },
    list: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const ShortcutsContext = createContext<Registry | null>(null);

const subscribeNothing = () => () => {};

/** True on an Apple device, false during the server render. */
export function useIsApple(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => isApple(navigator.platform || navigator.userAgent),
    () => false,
  );
}

/**
 * Central registry of the keyboard shortcuts of a shell (ADR 0098): one listener for the page,
 * single keys ignored while typing in a field, sequences (`g h`) within a second, a help listing
 * every shortcut on `?`.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('web.ui.shortcuts');
  const apple = useIsApple();
  const [helpOpen, setHelpOpen] = useState(false);
  const [registry] = useState(createRegistry);

  const registered = useSyncExternalStore(registry.subscribe, registry.list, () => NONE);

  useEffect(() => {
    type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;
    let previous: (KeyLike & { at: number }) | null = null;
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      const typing = isTypingTarget(event.target);
      const all = [
        ...registry.list(),
        { keys: '?', label: t('help'), group: t('general'), run: () => setHelpOpen(true) },
      ];
      // The second key of a sequence (`g` then `h`), within a second of the first.
      if (!typing && previous && Date.now() - previous.at < 1000) {
        const before = previous;
        const sequence = all.find((definition) => {
          const [first, second] = parseBinding(definition.keys);
          return first && second && matches(before, first, apple) && matches(event, second, apple);
        });
        if (sequence) {
          event.preventDefault();
          previous = null;
          sequence.run();
          return;
        }
      }
      for (const definition of all) {
        const [first, second] = parseBinding(definition.keys);
        // Single keys belong to the text while typing; Ctrl or Cmd combinations do not.
        if (!first || second || (typing && !first.mod)) continue;
        if (matches(event, first, apple)) {
          event.preventDefault();
          previous = null;
          definition.run();
          return;
        }
      }
      previous = typing
        ? null
        : {
            key: event.key,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            at: Date.now(),
          };
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [apple, t, registry]);

  const groups = new Map<string, ShortcutDefinition[]>();
  for (const definition of [
    ...registered,
    { keys: '?', label: t('help'), group: t('general'), run: () => undefined },
  ]) {
    groups.set(definition.group, [...(groups.get(definition.group) ?? []), definition]);
  }

  return (
    <ShortcutsContext value={registry}>
      {children}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent title={t('title')} description={t('description')} size="md">
          <div className="grid gap-6">
            {[...groups.entries()].map(([group, items]) => (
              <section key={group} className="grid gap-2">
                <h3 className="text-sm font-semibold">{group}</h3>
                <dl className="grid gap-1.5">
                  {items.map((item) => (
                    <div
                      key={item.keys}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <dt>{item.label}</dt>
                      <dd className="flex items-center gap-1">
                        {displayKeys(item.keys, apple).map((part, index) => (
                          <Kbd key={index}>{part}</Kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </ShortcutsContext>
  );
}

/** Registers a shortcut while the component is mounted (inside a ShortcutsProvider). */
export function useShortcut(definition: ShortcutDefinition): void {
  const registry = use(ShortcutsContext);
  const run = useRef(definition.run);
  useEffect(() => {
    run.current = definition.run;
  });
  const stableRun = useCallback(() => run.current(), []);
  useEffect(() => {
    if (!registry) return;
    return registry.register({
      keys: definition.keys,
      label: definition.label,
      group: definition.group,
      run: stableRun,
    });
  }, [registry, definition.keys, definition.label, definition.group, stableRun]);
}
