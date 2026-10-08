import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { DateTimeInput } from './date-time-input';
import { Field } from './field';
import { MoneyInput } from './money-input';

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

/** Wall clock of the place of the event, stored as an instant; the zone is named. */
export const DateAndTime: Story = {
  render: function Render() {
    const [instant, setInstant] = useState<string | null>('2026-11-20T17:00:00.000Z');
    return (
      <div className="grid max-w-md gap-3">
        <Field label="Début de l’événement">
          <DateTimeInput value={instant} onChange={setInstant} timeZone="Africa/Dakar" />
        </Field>
        <output className="text-sm text-muted" data-testid="instant">
          {instant}
        </output>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Début de l’événement' });
    await expect(within(group).getByLabelText('Heure')).toHaveValue('17:00');
    await expect(within(group).getByLabelText('Date')).toHaveAccessibleDescription(/Heure locale/);
  },
};
