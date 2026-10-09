'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import type { PrerequisiteElement } from '@pitchorium/contracts';
import {
  type ComponentType,
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

/** The dialog and the forms load at the first refusal only: no page pays for them before. */
const PrerequisiteDialog = lazy(() =>
  import('./prerequisite-dialog').then((module) => ({ default: module.PrerequisiteDialog })),
);

/** Form that completes one missing element, then says so (`onDone`). */
export interface PrerequisiteFormProps {
  onDone: () => void;
}

/** Forms of the elements the web app can complete in place, by element of the api. */
export type PrerequisiteForms = Partial<
  Record<PrerequisiteElement, ComponentType<PrerequisiteFormProps>>
>;

/**
 * Elements of an `ACCESS_PREREQUISITES_MISSING` refusal, in the order of the api, or null for any
 * other error.
 */
export function missingPrerequisites(error: unknown): string[] | null {
  if (!(error instanceof ApiProblemError)) return null;
  if (error.problem.code !== 'ACCESS_PREREQUISITES_MISSING') return null;
  return error.problem.missing?.length ? error.problem.missing : null;
}

/** The elements to complete here, in order; null when one of them has no form (the action stays refused). */
export function completablePrerequisites(
  missing: readonly string[],
  forms: PrerequisiteForms,
): PrerequisiteElement[] | null {
  const elements = missing as PrerequisiteElement[];
  return elements.every((element) => forms[element]) ? elements : null;
}

type Complete = (missing: readonly string[]) => Promise<boolean>;

const GateContext = createContext<Complete | null>(null);

/**
 * Progressive completion (§7.2, step 4): when the api refuses an action for missing elements, the
 * form of each one opens in a dialog, one after the other; once they are all completed, the
 * action runs again. Forms are given by the shell (email, terms, second factor today; the facets
 * of the profile with the PROMPT FRONT 3).
 */
export function PrerequisiteGateProvider({
  forms,
  children,
}: {
  forms: PrerequisiteForms;
  children: ReactNode;
}) {
  const [queue, setQueue] = useState<PrerequisiteElement[]>([]);
  const settle = useRef<((completed: boolean) => void) | null>(null);

  const complete = useCallback<Complete>(
    (missing) => {
      const ordered = completablePrerequisites(missing, forms);
      if (!ordered) return Promise.resolve(false);
      settle.current?.(false);
      setQueue(ordered);
      return new Promise<boolean>((resolve) => {
        settle.current = resolve;
      });
    },
    [forms],
  );

  const current = queue[0];
  const Form = current ? forms[current] : undefined;

  function finish(completed: boolean) {
    setQueue([]);
    settle.current?.(completed);
    settle.current = null;
  }

  function next() {
    if (queue.length <= 1) finish(true);
    else setQueue(queue.slice(1));
  }

  return (
    <GateContext value={complete}>
      {children}
      {current && Form ? (
        <Suspense fallback={null}>
          <PrerequisiteDialog
            element={current}
            Form={Form}
            onDone={next}
            onClose={() => finish(false)}
          />
        </Suspense>
      ) : null}
    </GateContext>
  );
}

/**
 * Runs an action of the api; refused for missing elements, it opens their forms and runs again
 * once they are completed. Any other error, or a closed dialog, is thrown as it came.
 */
export function useWithPrerequisites(): <T>(action: () => Promise<T>) => Promise<T> {
  const complete = use(GateContext);
  return useMemo(
    () =>
      async <T,>(action: () => Promise<T>): Promise<T> => {
        try {
          return await action();
        } catch (error) {
          const missing = missingPrerequisites(error);
          if (!missing || !complete || !(await complete(missing))) throw error;
          return action();
        }
      },
    [complete],
  );
}
