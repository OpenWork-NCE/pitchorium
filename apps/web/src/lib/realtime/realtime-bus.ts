/**
 * The realtime events a page listens to (a conversation open, the list of conversations, the
 * notifications), and what it sends (typing). Kept out of the connection: a page subscribes at
 * once, the connection (Socket.IO) and the schemas load later (ADR 0094). Every payload given to
 * a listener has passed its schema of the contracts (realtime-handlers.ts).
 */

type Listener = (payload: unknown) => void;

/**
 * Names of the events of the api (`SERVER_EVENTS` and `CLIENT_EVENTS` of the contracts, copied:
 * a constant of the contracts would bring Zod into the first load; realtime-bus.spec.ts keeps
 * them equal).
 */
export const REALTIME_EVENTS = {
  message: 'messaging:message',
  messageUpdated: 'messaging:message-updated',
  read: 'messaging:read',
  typing: 'messaging:typing',
  conversation: 'messaging:conversation',
  notification: 'notifications:notification',
  counters: 'counters',
} as const;

/** Local events of the channel, never sent by the api. */
export const LOCAL_EVENTS = {
  /** The channel is open again after a cut or a pause: what was missed is to be read. */
  resumed: 'local:resumed',
} as const;

const listeners = new Map<string, Set<Listener>>();

interface Sender {
  emit(event: string, payload: unknown): void;
}

let sender: Sender | null = null;

/** Listens to an event; returns the function that stops listening. */
export function onRealtime(event: string, listener: Listener): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** Gives a checked payload to the listeners of its event. */
export function dispatchRealtime(event: string, payload: unknown): void {
  for (const listener of listeners.get(event) ?? []) listener(payload);
}

/** The open connection, or null while closed (set by realtime-connection.ts). */
export function setRealtimeSender(next: Sender | null): void {
  sender = next;
}

/**
 * Sends an event without acknowledgement (typing): nothing is sent while the channel is closed,
 * an event without persistence is never worth a queue. True when it left.
 */
export function emitRealtime(event: string, payload: unknown): boolean {
  if (!sender) return false;
  sender.emit(event, payload);
  return true;
}
