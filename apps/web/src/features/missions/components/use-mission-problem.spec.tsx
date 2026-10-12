// @vitest-environment jsdom
import { ApiProblemError } from '@pitchorium/api-client';
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { messagesFor } from '@/lib/i18n/messages';
import { useMissionProblem } from './use-mission-problem';

type Code = ApiProblemError['problem']['code'];

const problem = (code: Code, status = 422) =>
  new ApiProblemError({ type: 'about:blank', title: code, status, code });

function wrapper(locale: 'fr' | 'en') {
  return ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale)} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

describe('refusals of a mission', () => {
  it('explains the volunteer nature when the vocabulary of a job offer is refused', () => {
    const { result } = renderHook(() => useMissionProblem(), { wrapper: wrapper('fr') });
    expect(result.current(problem('MISSIONS_JOB_POSTING_REFUSED'))).toBe(
      'Une mission est bénévole\u00a0: retirez le vocabulaire d’une offre d’emploi (salaire, rémunération, contrat, CDI, recrutement, temps plein…).',
    );
    const english = renderHook(() => useMissionProblem(), { wrapper: wrapper('en') });
    expect(english.result.current(problem('MISSIONS_JOB_POSTING_REFUSED'))).toMatch(
      /^A mission is voluntary/,
    );
  });

  it('gives the bounds of hours of each format and names the hat to add', () => {
    const { result } = renderHook(() => useMissionProblem(), { wrapper: wrapper('fr') });
    expect(result.current(problem('MISSIONS_HOURS_EXCEEDED'))).toBe(
      'Trop d’heures pour ce format\u00a0: 8 h au plus pour une session, 80 h pour une mission courte.',
    );
    expect(result.current(problem('MISSIONS_HAT_REQUIRED'))).toMatch(/casquette expert ou mentor/);
  });

  it('says any other refusal by its code', () => {
    const { result } = renderHook(() => useMissionProblem(), { wrapper: wrapper('fr') });
    expect(result.current(problem('MISSIONS_CLOSED', 409))).toBe('Cette mission est fermée.');
  });
});
