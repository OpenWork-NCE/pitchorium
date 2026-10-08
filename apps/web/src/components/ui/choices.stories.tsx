import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Checkbox } from './checkbox';
import { Field } from './field';
import { RadioGroup } from './radio-group';
import { Select } from './select';
import { Slider } from './slider';
import { Switch } from './switch';

const meta = { title: 'Design system/Forms/Choices' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Checkboxes: Story = {
  render: function Render() {
    const [terms, setTerms] = useState(false);
    return (
      <div className="grid max-w-md gap-3">
        <Checkbox
          label="J’accepte les conditions d’utilisation"
          description="Version du 1er octobre 2026."
          checked={terms}
          onCheckedChange={(value) => setTerms(value === true)}
        />
        <Checkbox label="Tout sélectionner" checked="indeterminate" />
        <Checkbox label="Option indisponible" disabled />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const terms = canvas.getByRole('checkbox', { name: 'J’accepte les conditions d’utilisation' });
    await expect(terms).toHaveAccessibleDescription('Version du 1er octobre 2026.');
    await userEvent.click(canvas.getByText('J’accepte les conditions d’utilisation'));
    await expect(terms).toBeChecked();
    await userEvent.keyboard(' ');
    await expect(terms).not.toBeChecked();
  },
};

export const Radios: Story = {
  render: function Render() {
    const [intention, setIntention] = useState<'carry' | 'support' | undefined>(undefined);
    return (
      <div className="grid max-w-md gap-8">
        <Field label="Je viens pour">
          <RadioGroup
            value={intention}
            onValueChange={setIntention}
            options={[
              { value: 'carry', label: 'Porter un projet' },
              { value: 'support', label: 'Soutenir des projets' },
            ]}
          />
        </Field>
        <Field label="Visibilité de la publication">
          <RadioGroup
            variant="card"
            value="members"
            onValueChange={() => undefined}
            options={[
              { value: 'public', label: 'Public', description: 'Visible de tous, indexée.' },
              { value: 'members', label: 'Membres', description: 'Visible des membres connectés.' },
              {
                value: 'connections',
                label: 'Connexions',
                description: 'Visible de vos connexions.',
                disabled: true,
              },
            ]}
          />
        </Field>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('radiogroup', { name: 'Je viens pour' });
    await userEvent.click(within(group).getByRole('radio', { name: 'Porter un projet' }));
    await expect(within(group).getByRole('radio', { name: 'Porter un projet' })).toBeChecked();
    // Held down, as a person does: Radix checks the radio the arrow moves to while it is pressed.
    await userEvent.keyboard('{ArrowDown>}');
    await waitFor(() =>
      expect(within(group).getByRole('radio', { name: 'Soutenir des projets' })).toBeChecked(),
    );
    await userEvent.keyboard('{/ArrowDown}');
  },
};

export const Switches: Story = {
  render: function Render() {
    const [digest, setDigest] = useState(true);
    return (
      <div className="grid max-w-md gap-2">
        <Switch
          label="Résumé quotidien par email"
          description="Chaque matin à 8 h."
          checked={digest}
          onCheckedChange={setDigest}
        />
        <Switch label="Visite privée des profils" disabled />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole('switch', {
      name: 'Résumé quotidien par email',
    });
    await expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await expect(toggle).not.toBeChecked();
  },
};

export const Sliders: Story = {
  render: function Render() {
    const [hours, setHours] = useState([4]);
    return (
      <div className="max-w-md">
        <Field label="Disponibilité de mentorat">
          <Slider
            value={hours}
            onValueChange={setHours}
            min={0}
            max={20}
            step={1}
            formatValue={(value) => `${value} heures par mois`}
          />
        </Field>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const thumb = within(canvasElement).getByRole('slider', { name: 'Disponibilité de mentorat' });
    await userEvent.click(thumb);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(thumb).toHaveAttribute('aria-valuetext', '6 heures par mois');
  },
};

export const SelectList: Story = {
  render: function Render() {
    const [stage, setStage] = useState<string | undefined>(undefined);
    return (
      <div className="grid max-w-md gap-6">
        <Field label="Stade du projet">
          <Select
            value={stage}
            onValueChange={setStage}
            options={[
              { value: 'idea', label: 'Idée' },
              { value: 'prototype', label: 'Prototype' },
              { value: 'growth', label: 'Croissance' },
            ]}
          />
        </Field>
        <Field label="Devise" error="Choisissez une des valeurs proposées.">
          <Select
            value={undefined}
            onValueChange={() => undefined}
            options={[{ value: 'EUR', label: 'Euro' }]}
          />
        </Field>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox', { name: 'Stade du projet' });
    await userEvent.click(trigger);
    await userEvent.click(await within(document.body).findByRole('option', { name: 'Prototype' }));
    await waitFor(() => expect(trigger).toHaveTextContent('Prototype'));
    await expect(canvas.getByRole('combobox', { name: 'Devise' })).toBeInvalid();
  },
};
