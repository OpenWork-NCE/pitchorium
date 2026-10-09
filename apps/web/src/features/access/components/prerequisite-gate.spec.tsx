// @vitest-environment jsdom
import { ApiProblemError } from '@pitchorium/api-client';
import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import {
  completablePrerequisites,
  missingPrerequisites,
  type PrerequisiteFormProps,
  PrerequisiteGateProvider,
  useWithPrerequisites,
} from './prerequisite-gate';

const refused = (missing: string[]) =>
  new ApiProblemError({
    type: 'about:blank',
    title: 'Action prerequisites are missing',
    status: 403,
    code: 'ACCESS_PREREQUISITES_MISSING',
    missing,
  });

function Done({ label }: { label: string }) {
  return ({ onDone }: PrerequisiteFormProps) => <button onClick={onDone}>{label}</button>;
}

const forms = {
  legal_acceptance: Done({ label: 'accept terms' }),
  email_verified: Done({ label: 'verify email' }),
};

function Action({ run }: { run: () => Promise<string> }) {
  const withPrerequisites = useWithPrerequisites();
  const [result, setResult] = useState('idle');
  return (
    <>
      <button
        onClick={() =>
          void withPrerequisites(run).then(setResult, (error: unknown) =>
            setResult(error instanceof ApiProblemError ? `refused:${error.problem.code}` : 'error'),
          )
        }
      >
        act
      </button>
      <output>{result}</output>
    </>
  );
}

/** Clicks, then lets the refusal reach the gate (a promise rejection, then a render). */
async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

function render(run: () => Promise<string>) {
  return renderWithProviders(
    <PrerequisiteGateProvider forms={forms}>
      <Action run={run} />
    </PrerequisiteGateProvider>,
  );
}

describe('prerequisite gate (§7.2, step 4)', () => {
  it('reads the missing elements of a refusal only', () => {
    expect(missingPrerequisites(refused(['email_verified']))).toEqual(['email_verified']);
    expect(missingPrerequisites(new Error('network'))).toBeNull();
    expect(completablePrerequisites(['legal_acceptance', 'email_verified'], forms)).toEqual([
      'legal_acceptance',
      'email_verified',
    ]);
    expect(completablePrerequisites(['kyc_verified'], forms)).toBeNull();
  });

  it('opens each form in turn, then runs the action again', async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(refused(['legal_acceptance', 'email_verified']))
      .mockResolvedValueOnce('done');
    render(run);
    await click(screen.getByRole('button', { name: 'act' }));
    await click(await screen.findByText('accept terms'));
    await click(await screen.findByText('verify email'));
    expect(await screen.findByText('done')).toBeTruthy();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('gives the refusal back when the dialog is closed, or when an element has no form', async () => {
    const run = vi.fn<() => Promise<string>>().mockRejectedValue(refused(['legal_acceptance']));
    const { unmount } = render(run);
    await click(screen.getByRole('button', { name: 'act' }));
    await click(await screen.findByText('Plus tard'));
    expect(screen.getByText('refused:ACCESS_PREREQUISITES_MISSING')).toBeTruthy();
    expect(run).toHaveBeenCalledTimes(1);
    unmount();

    const kyc = vi.fn<() => Promise<string>>().mockRejectedValue(refused(['kyc_verified']));
    render(kyc);
    await click(screen.getByRole('button', { name: 'act' }));
    expect(screen.getByText('refused:ACCESS_PREREQUISITES_MISSING')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
