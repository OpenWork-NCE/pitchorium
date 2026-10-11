'use client';

import { useEffect, useRef } from 'react';
import { onRealtime } from './realtime-bus';

/**
 * Listens to a realtime event while the component is mounted; the payload has passed its schema
 * (realtime-handlers.ts). The latest handler is called, without listening again at each render.
 */
export function useRealtime<T>(event: string, handler: (payload: T) => void): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => onRealtime(event, (payload) => latest.current(payload as T)), [event]);
}
