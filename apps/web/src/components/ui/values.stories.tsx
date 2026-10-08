import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { DateTimeField } from './date-time-field';
import { Field } from './field';
import { MoneyInput } from './money-input';
import { TimeZoneSelect } from './time-zone-select';

const meta = { title: 'Design system/Forms/Amounts and dates' } satisfies Meta;
export default meta;
type Story = StoryObj;

/** Typed in the page language, kept in minor units without any float, formatted on leaving. */
export const Money: Story = {
  render: function Render() {
    const [eur, setEur] = useState<string | null>('250000');
    const [xaf, setXaf] = useState<string | null>(null);
    return (
      <div className="grid max-w-md gap-6">
        <Field label="Objectif de la campagne">
          <MoneyInput currency="EUR" value={eur} onChange={setEur} />
        </Field>
        <Field label="Montant en francs CFA" description="Sans décimale.">
          <MoneyInput currency="XAF" value={xaf} onChange={setXaf} />
        </Field>
        <output className="text-sm text-muted" data-testid="minor">
          {eur ?? '-'} / {xaf ?? '-'}
        </output>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const goal = canvas.getByRole('textbox', { name: 'Objectif de la campagne' });
    await expect(goal).toHaveValue('2 500,00');
    await expect(goal).toHaveAccessibleDescription('Montant en euro');
    await userEvent.clear(goal);
    await userEvent.type(goal, '1234,5');
    await userEvent.tab();
    await expect(goal).toHaveValue('1 234,50');
    const xaf = canvas.getByRole('textbox', { name: 'Montant en francs CFA' });
    await userEvent.type(xaf, '2500000');
    await userEvent.tab();
    await expect(canvas.getByTestId('minor')).toHaveTextContent('123450 / 2500000');
  },
};

/**
 * Wall clock of the place of the event, typed segment by segment in the order of the language of
 * the application (not the browser), stored as an instant; the zone is said once, next to the
 * dates, and can be changed.
 */
function DatesOfAnEvent() {
  const [start, setStart] = useState<string | null>('2026-11-20T17:00:00.000Z');
  const [end, setEnd] = useState<string | null>(null);
  const [zone, setZone] = useState('Africa/Dakar');
  return (
    <div className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Début de l’événement">
          <DateTimeField value={start} onChange={setStart} timeZone={zone} />
        </Field>
        <Field label="Fin de l’événement">
          <DateTimeField value={end} onChange={setEnd} timeZone={zone} />
        </Field>
      </div>
      <Field label="Fuseau horaire">
        <TimeZoneSelect value={zone} onChange={setZone} at={start} />
      </Field>
      <output className="text-sm text-muted" data-testid="instants">
        {start ?? '-'} / {end ?? '-'}
      </output>
    </div>
  );
}

export const DateAndTime: Story = {
  render: () => <DatesOfAnEvent />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const start = within(canvas.getByRole('group', { name: 'Début de l’événement' }));
    await expect(start.getAllByRole('spinbutton').map((segment) => segment.textContent)).toEqual([
      '20',
      '11',
      '2026',
      '17',
      '00',
    ]);
    // The keyboard alone: digits move from segment to segment, the arrows change a value.
    const end = within(canvas.getByRole('group', { name: 'Fin de l’événement' }));
    await userEvent.click(end.getByRole('spinbutton', { name: 'Jour' }));
    await userEvent.keyboard('201120261930');
    await expect(canvas.getByTestId('instants')).toHaveTextContent(
      '2026-11-20T17:00:00.000Z / 2026-11-20T19:30:00.000Z',
    );
    await userEvent.keyboard('{ArrowUp}');
    await expect(end.getByRole('spinbutton', { name: 'Minutes' })).toHaveAttribute(
      'aria-valuenow',
      '31',
    );
    // The day picked in the calendar keeps the time.
    await userEvent.click(end.getByRole('button', { name: 'Choisir la date dans le calendrier' }));
    const day = await within(document.body).findByRole('button', {
      name: /samedi 21 novembre 2026/,
    });
    await userEvent.click(day);
    await expect(canvas.getByTestId('instants')).toHaveTextContent('2026-11-21T19:31:00.000Z');
    // The zone is said once, and changing it keeps the wall clock.
    await expect(canvas.getByRole('combobox', { name: 'Fuseau horaire' })).toHaveTextContent(
      'Dakar, GMT+0',
    );
  },
};

/** In English, the order and the clock of English: month first, 12 hours. */
export const DateAndTimeInEnglish: Story = {
  globals: { locale: 'en' },
  render: () => <DatesOfAnEvent />,
  play: async ({ canvasElement }) => {
    const start = within(
      within(canvasElement).getByRole('group', { name: 'Début de l’événement' }),
    );
    await expect(start.getAllByRole('spinbutton').map((segment) => segment.textContent)).toEqual([
      '11',
      '20',
      '2026',
      '05',
      '00',
      'PM',
    ]);
  },
};
