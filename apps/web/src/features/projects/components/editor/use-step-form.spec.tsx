// @vitest-environment jsdom
import type { Project } from '@pitchorium/contracts';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectEditorProvider } from './editor-context';
import { AUTOSAVE_DELAY_MS } from './use-autosave';
import { useStepAutosave } from './use-step-form';

type Values = { title: string };

/** A step whose buttons render it again or change its value (test texts, not of the interface). */
function Step({ save }: { save: (values: Values) => Promise<void> }) {
  const form = useForm<Values>({ defaultValues: { title: 'Ferme solaire' } });
  const [, setTick] = useState(0);
  useStepAutosave(form, save);
  return (
    <>
      <button type="button" onClick={() => setTick((tick) => tick + 1)}>
        render
      </button>
      <button type="button" onClick={() => form.setValue('title', 'Ferme solaire de Thiès')}>
        change
      </button>
    </>
  );
}

describe('the deferred save of a step of the assistant', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends nothing on a render without change, then the values once they change', async () => {
    const save = vi.fn(() => Promise.resolve());
    render(
      <ProjectEditorProvider initial={{ id: 'project' } as Project}>
        <Step save={save} />
      </ProjectEditorProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'render' }));
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2));
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'change' }));
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: 'Ferme solaire de Thiès' });
  });
});
