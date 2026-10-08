// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test/support/render';
import { DateTimeField } from './date-time-field';
import { Field } from './field';

function Harness({
  zone = 'Africa/Dakar',
  initial = null,
}: {
  zone?: string;
  initial?: string | null;
}) {
  const [value, setValue] = useState<string | null>(initial);
  const [timeZone, setTimeZone] = useState(zone);
  return (
    <>
      <Field label="Début">
        <DateTimeField value={value} onChange={setValue} timeZone={timeZone} />
      </Field>
      <output data-testid="value">{value ?? 'null'}</output>
      <button type="button" onClick={() => setTimeZone('Europe/Paris')}>
        Paris
      </button>
    </>
  );
}

const segments = () => screen.getAllByRole('spinbutton');
const names = () => segments().map((segment) => segment.getAttribute('aria-label'));
const type = (text: string) => {
  for (const key of text) fireEvent.keyDown(document.activeElement ?? document.body, { key });
};

describe('DateTimeField', () => {
  it('orders its segments by the language of the application, not the browser', () => {
    renderWithProviders(<Harness />);
    expect(names()).toEqual(['Jour', 'Mois', 'Année', 'Heures', 'Minutes']);
    expect(segments().map((segment) => segment.textContent)).toEqual([
      'jj',
      'mm',
      'aaaa',
      'hh',
      'mm',
    ]);
  });

  it('reads and writes the wall clock of its zone, in 12 hours in English', () => {
    renderWithProviders(<Harness initial="2026-11-20T17:05:00.000Z" zone="Europe/Paris" />, {
      locale: 'en',
    });
    expect(names()).toEqual(['Month', 'Day', 'Year', 'Hours', 'Minutes', 'AM or PM']);
    expect(segments().map((segment) => segment.textContent)).toEqual([
      '11',
      '20',
      '2026',
      '06',
      '05',
      'PM',
    ]);
  });

  it('is typed with the keyboard alone, moving on from segment to segment', () => {
    renderWithProviders(<Harness />);
    segments()[0]?.focus();
    type('20112026');
    expect(document.activeElement).toBe(segments()[3]);
    type('1805');
    expect(screen.getByTestId('value').textContent).toBe('2026-11-20T18:05:00.000Z');
    expect(segments()[1]?.getAttribute('aria-valuetext')).toBe('11, novembre');

    // Arrows change the focused segment, left and right move between segments.
    fireEvent.keyDown(segments()[4]!, { key: 'ArrowUp' });
    expect(screen.getByTestId('value').textContent).toBe('2026-11-20T18:06:00.000Z');
    fireEvent.keyDown(segments()[4]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(segments()[3]);
    fireEvent.keyDown(segments()[3]!, { key: 'End' });
    expect(segments()[3]?.textContent).toBe('23');

    // Backspace empties the segment: the value is incomplete again.
    fireEvent.keyDown(segments()[3]!, { key: 'Backspace' });
    fireEvent.keyDown(segments()[3]!, { key: 'Backspace' });
    expect(segments()[3]?.textContent).toBe('hh');
    expect(screen.getByTestId('value').textContent).toBe('null');
  });

  it('keeps the wall clock when the zone changes, and gives another instant', () => {
    renderWithProviders(<Harness initial="2026-11-20T18:00:00.000Z" />);
    fireEvent.click(screen.getByRole('button', { name: 'Paris' }));
    expect(segments()[3]?.textContent).toBe('18');
    expect(screen.getByTestId('value').textContent).toBe('2026-11-20T17:00:00.000Z');
  });

  it('is a group named by its label, the first segment the target of the label', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole('group', { name: 'Début' })).toBeTruthy();
    expect(screen.getByText('Début').getAttribute('for')).toBe(segments()[0]?.id);
    expect(screen.getByRole('button', { name: 'Choisir la date dans le calendrier' })).toBeTruthy();
  });
});
