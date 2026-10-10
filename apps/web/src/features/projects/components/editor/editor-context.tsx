'use client';

import { projectsControllerGet } from '@pitchorium/api-client';
import type { Project } from '@pitchorium/contracts';
import { createContext, type ReactNode, use, useCallback, useMemo, useRef, useState } from 'react';

/** Where the saving of the draft stands, for the indicator « Enregistré ». */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface EditorValue {
  /** The project as the api last gave it (management data included). */
  project: Project;
  /** Takes the project an answer of the api gives (PATCH, PUT, publication). */
  setProject: (project: Project) => void;
  /** Reads the project again (after a write that answers nothing, a member of the team). */
  refresh: () => Promise<void>;
  save: SaveState;
  setSave: (state: SaveState) => void;
  /** Saves what the current step still holds, before leaving it. */
  flush: () => Promise<void>;
  /** The step gives its own saving to `flush`. */
  registerFlush: (flush: (() => Promise<void>) | null) => void;
}

const EditorContext = createContext<EditorValue | null>(null);

/**
 * The project being created or edited, shared by the steps of the assistant and the panels of
 * the management (ADR 0131): the api keeps the draft, the page keeps its last answer.
 */
export function ProjectEditorProvider({
  initial,
  children,
}: {
  initial: Project;
  children: ReactNode;
}) {
  const [project, setProject] = useState(initial);
  const [save, setSave] = useState<SaveState>('idle');
  const refresh = useCallback(async () => {
    setProject(await projectsControllerGet(initial.id));
  }, [initial.id]);
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const flush = useCallback(async () => {
    await flushRef.current?.();
  }, []);
  const registerFlush = useCallback((next: (() => Promise<void>) | null) => {
    flushRef.current = next;
  }, []);
  const value = useMemo(
    () => ({ project, setProject, refresh, save, setSave, flush, registerFlush }),
    [project, refresh, save, flush, registerFlush],
  );
  return <EditorContext value={value}>{children}</EditorContext>;
}

export function useProjectEditor(): EditorValue {
  const value = use(EditorContext);
  if (!value) throw new Error('useProjectEditor outside of ProjectEditorProvider');
  return value;
}
