import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Mail, Search } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Field } from './field';
import { Input } from './input';
import { OtpInput } from './otp-input';
import { PasswordInput } from './password-input';
import { Textarea } from './textarea';

const meta = { title: 'Design system/Forms/Text inputs' } satisfies Meta;
export default meta;
type Story = StoryObj;

/** Label, description and error tied to the control by ids. */
export const FieldStates: Story = {
  render: () => (
    <div className="grid max-w-md gap-6">
      <Field label="Adresse email" description="Celle de votre compte.">
        <Input
          type="email"
          autoComplete="email"
          startAdornment={<Mail />}
          placeholder="vous@exemple.org"
        />
      </Field>
      <Field label="Titre" required error="Ce champ est obligatoire.">
        <Input />
      </Field>
      <Field label="Site web" optional>
        <Input type="url" inputMode="url" />
      </Field>
      <Field label="Identifiant" disabled>
        <Input defaultValue="aissatou-ba" />
      </Field>
      <Field label="Rechercher" hideLabel>
        <Input type="search" startAdornment={<Search />} />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByRole('textbox', { name: 'Adresse email' });
    await expect(email).toHaveAccessibleDescription('Celle de votre compte.');
    const title = canvas.getByRole('textbox', { name: 'Titre' });
    await expect(title).toBeInvalid();
    await expect(title).toHaveAttribute('aria-required', 'true');
    await expect(title).toHaveAccessibleDescription('Ce champ est obligatoire.');
    await expect(canvas.getByRole('textbox', { name: 'Identifiant' })).toBeDisabled();
    await expect(canvas.getByRole('searchbox', { name: 'Rechercher' })).toBeVisible();
  },
};

/** Grows with its text, the counter warns near the limit and turns the field invalid beyond it. */
export const TextareaWithCounter: Story = {
  render: function Render() {
    const [value, setValue] = useState('Nous nous sommes croisés à Abidjan.');
    return (
      <div className="max-w-md">
        <Field label="Note de connexion" counter={{ count: value.length, max: 300 }}>
          <Textarea value={value} onChange={(event) => setValue(event.target.value)} />
        </Field>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const note = canvas.getByRole('textbox', { name: 'Note de connexion' });
    const height = note.getBoundingClientRect().height;
    await userEvent.type(note, '{enter}Et à nouveau à Paris.{enter}{enter}{enter}{enter}Merci !');
    await expect(note.getBoundingClientRect().height).toBeGreaterThan(height);
    await expect(note).toHaveAccessibleDescription(/sur 300 caractères/);
  },
};

/** The text is never shown by default; the toggle says its state (aria-pressed). */
export const Password: Story = {
  render: () => (
    <div className="max-w-md">
      <Field label="Mot de passe" description="12 caractères au moins.">
        <PasswordInput autoComplete="new-password" />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText('Mot de passe');
    await expect(field).toHaveAttribute('type', 'password');
    const toggle = canvas.getByRole('button', { name: 'Afficher le mot de passe' });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(field).toHaveAttribute('type', 'text');
  },
};

/** One real input: paste and the one-time-code autofill fill every box. */
export const OneTimeCode: Story = {
  render: function Render() {
    const [code, setCode] = useState('');
    const [done, setDone] = useState('');
    return (
      <div className="grid max-w-md gap-3">
        <Field label="Code de vérification">
          <OtpInput value={code} onChange={setCode} onComplete={setDone} />
        </Field>
        <p role="status" className="text-sm text-muted">
          {done}
        </p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Code de vérification' });
    await expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
    await userEvent.click(input);
    await userEvent.paste('12a 34-56');
    await expect(input).toHaveValue('123456');
    await expect(canvas.getByRole('status')).toHaveTextContent('123456');
  },
};

export const Invalid: Story = {
  render: () => (
    <div className="max-w-md">
      <Field label="Code de vérification" error="Ce code a expiré. Demandez-en un nouveau.">
        <OtpInput value="4821" onChange={() => undefined} />
      </Field>
    </div>
  ),
};
