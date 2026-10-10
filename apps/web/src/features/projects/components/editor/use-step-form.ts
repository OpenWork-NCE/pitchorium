'use client';

import { useEffect, useRef } from 'react';
import { type FieldValues, type UseFormReturn, useWatch } from 'react-hook-form';
import { useAutosave } from './use-autosave';

/**
 * A form of a step saved as it is written (ADR 0131): every change schedules the deferred save,
 * which checks the values first and sends nothing while they are not valid.
 */
export function useStepAutosave<T extends FieldValues>(
  form: UseFormReturn<T>,
  save: (values: T) => Promise<void>,
) {
  const autosave = useAutosave(async () => {
    if (!(await form.trigger())) return false;
    await save(form.getValues());
    return true;
  });
  // The values compared by their content: the form may give a new object without any change (its
  // schema arriving on demand), which must not send the draft again.
  const signature = JSON.stringify(useWatch({ control: form.control }));
  const saved = useRef(signature);
  useEffect(() => {
    if (signature === saved.current) return;
    saved.current = signature;
    autosave.schedule();
  }, [signature, autosave]);
  return autosave;
}
