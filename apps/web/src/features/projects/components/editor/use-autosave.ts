'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useProjectEditor } from './editor-context';

/** Delay after the last change before the draft is saved. */
export const AUTOSAVE_DELAY_MS = 800;

/**
 * Deferred saving of a step of the assistant (ADR 0131): a change schedules the save, a new
 * change postpones it, leaving the step (or the page) saves at once. The indicator of the
 * assistant says « Enregistrement », « Enregistré » or the failure. `save` returns false when
 * the values are not valid yet (nothing is sent).
 */
export function useAutosave(save: () => Promise<boolean>) {
  const { setSave, registerFlush } = useProjectEditor();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!pending.current) return;
    pending.current = false;
    setSave('saving');
    try {
      const sent = await latest.current();
      setSave(sent ? 'saved' : 'idle');
    } catch {
      setSave('error');
    }
  }, [setSave]);

  const schedule = useCallback(() => {
    pending.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }, [flush]);

  // Leaving the step saves what is pending; closing the tab too, as far as the browser lets it.
  useEffect(() => {
    registerFlush(flush);
    const leave = () => void flush();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      registerFlush(null);
      void flush();
    };
  }, [flush, registerFlush]);

  return { schedule, flush };
}
