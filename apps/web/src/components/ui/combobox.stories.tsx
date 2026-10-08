import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useCallback, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Combobox, type ComboboxOption } from './combobox';
import { Field } from './field';

const COUNTRIES: ComboboxOption[] = [
  { value: 'SN', label: 'Sénégal', hint: 'Afrique de l’Ouest' },
  { value: 'CI', label: 'Côte d’Ivoire', hint: 'Afrique de l’Ouest' },
  { value: 'CM', label: 'Cameroun', hint: 'Afrique centrale' },
  { value: 'HT', label: 'Haïti', hint: 'Caraïbes' },
  { value: 'MQ', label: 'Martinique', hint: 'Caraïbes' },
  { value: 'FR', label: 'France', hint: 'Europe' },
];

const meta = { title: 'Design system/Forms/Combobox', component: Combobox } satisfies Meta<
  typeof Combobox
>;
export default meta;
type Story = StoryObj;

export const Single: Story = {
  render: function Render() {
    const [value, setValue] = useState<string | null>(null);
    return (
      <div className="max-w-md">
        <Field label="Pays de résidence">
          <Combobox
            options={COUNTRIES}
            value={value}
            onValueChange={setValue}
            placeholder="Choisir un pays"
          />
        </Field>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox', { name: 'Pays de résidence' });
    await userEvent.click(trigger);
    await userEvent.keyboard('cam');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(trigger).toHaveTextContent('Cameroun'));
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};

/** Chips for the countries and sectors; the list stays open to choose several. */
export const MultipleWithChips: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>(['SN', 'HT']);
    return (
      <div className="max-w-md">
        <Field label="Pays d’intervention" description="Trois au plus.">
          <Combobox
            multiple
            max={3}
            options={COUNTRIES}
            value={value}
            onValueChange={setValue}
            placeholder="Ajouter un pays"
          />
        </Field>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Retirer Haïti' }));
    await expect(canvas.queryByRole('button', { name: 'Retirer Haïti' })).toBeNull();
    await userEvent.click(canvas.getByRole('combobox', { name: 'Pays d’intervention' }));
    await userEvent.keyboard('fra{Enter}');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Retirer France' })).toBeVisible(),
    );
    await userEvent.keyboard('{Escape}');
  },
};

/** The server answers the search (after a pause in typing); the wait is shown and announced. */
export const AsyncSearch: Story = {
  render: function Render() {
    const [value, setValue] = useState<string | null>(null);
    const [options, setOptions] = useState<ComboboxOption[]>([]);
    const [loading, setLoading] = useState(false);
    const search = useCallback((query: string) => {
      setLoading(true);
      setTimeout(() => {
        setOptions(
          COUNTRIES.filter((country) => country.label.toLowerCase().includes(query.toLowerCase())),
        );
        setLoading(false);
      }, 300);
    }, []);
    return (
      <div className="max-w-md">
        <Field label="Organisation">
          <Combobox
            options={options}
            onSearch={search}
            loading={loading}
            value={value}
            onValueChange={setValue}
          />
        </Field>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox', { name: 'Organisation' }));
    await userEvent.keyboard('ma');
    await waitFor(
      () => expect(within(document.body).getByRole('option', { name: /Martinique/ })).toBeVisible(),
      { timeout: 3000 },
    );
  },
};
