'use client';

import { useTranslations } from 'next-intl';
import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { preloadWhenIdle } from '@/lib/preload';
import { isApple, isTypingTarget, matches, parseBinding } from '@/lib/shortcuts/keys';

/** The help and its dialog stay out of the first load; they arrive when the page is idle. */
const loadHelp = () => import('./shortcuts-help');
const ShortcutsHelp = lazy(loadHelp);

export interface ShortcutDefinition {
  /** `mod+k`, `?`, `g h` (lib/shortcuts/keys.ts). */
  keys: string;
  /**
   * What it does, shown in the help: a function when it is formatted (a message with values),
   * formatted only when the help opens, not while the page starts.
   */
  label: string | (() => string);
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
const HelpContext = createContext<() => void>(() => undefined);

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
  const openHelp = useCallback(() => setHelpOpen(true), []);
  useEffect(() => preloadWhenIdle(loadHelp), []);

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
      <HelpContext value={openHelp}>{children}</HelpContext>
      {helpOpen ? (
        <Suspense fallback={null}>
          <ShortcutsHelp
            groups={[...groups.entries()]}
            apple={apple}
            onClose={() => setHelpOpen(false)}
          />
        </Suspense>
      ) : null}
    </ShortcutsContext>
  );
}

/** What a label adds to the identity of a shortcut: its text, or nothing for a function. */
function labelKey(label: ShortcutDefinition['label']): string {
  return typeof label === 'string' ? label : '';
}

/** The text of a label, formatted now if it is a function. */
export function labelText(label: ShortcutDefinition['label']): string {
  return typeof label === 'string' ? label : label();
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
    // A label given as a function is read by the help: its identity does not matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, definition.keys, labelKey(definition.label), definition.group, stableRun]);
}

/** Opens the help of the shortcuts (from a menu): the `?` key does the same. */
export function useShortcutsHelp(): () => void {
  return use(HelpContext);
}

/**
 * Registers several shortcuts at once while mounted (the sections of a navigation); the list is
 * compared by its keys and labels, its actions are always the latest.
 */
export function useShortcuts(definitions: readonly ShortcutDefinition[]): void {
  const registry = use(ShortcutsContext);
  const latest = useRef(definitions);
  useEffect(() => {
    latest.current = definitions;
  });
  const signature = definitions
    .map((definition) => `${definition.keys}|${labelKey(definition.label)}|${definition.group}`)
    .join('\n');
  useEffect(() => {
    if (!registry) return;
    const removals = latest.current.map((definition, index) =>
      registry.register({ ...definition, run: () => latest.current[index]?.run() }),
    );
    return () => {
      for (const remove of removals) remove();
    };
  }, [registry, signature]);
}
