import { ApiProblemError } from '@pitchorium/api-client';
import { CONNECTION_NOTE_MAX_LENGTH, createConnectionRequestSchema } from '@pitchorium/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useRef } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './button';
import { Form, FormField, useApplyProblem, useZodForm } from './form';
import { Input } from './input';
import { Textarea } from './textarea';

const meta = { title: 'Design system/Forms/Form' } satisfies Meta;
export default meta;
type Story = StoryObj;

/**
 * A form on a schema of @pitchorium/contracts (react-hook-form and Zod), then the answer of the
 * api: here a problem with a field error and, on a second submit, an error of the whole form.
 */
function ConnectionForm({ answer }: { answer: (attempt: number) => ApiProblemError }) {
  const form = useZodForm(createConnectionRequestSchema, { defaultValues: { handle: '' } });
  const applyProblem = useApplyProblem(form);
  const attempt = useRef(0);
  return (
    <Form
      form={form}
      className="max-w-md"
      onSubmit={() => {
        attempt.current += 1;
        applyProblem(answer(attempt.current));
      }}
    >
      <FormField
        name="handle"
        label="Identifiant du membre"
        description="Celui de son adresse de profil."
        required
        render={({ field }) => <Input {...field} autoComplete="off" />}
      />
      <FormField
        name="note"
        label="Note"
        optional
        maxLength={CONNECTION_NOTE_MAX_LENGTH}
        render={({ field }) => (
          <Textarea
            {...field}
            value={String(field.value ?? '')}
            // An optional text left empty is absent, not an empty string (patterns.md).
            onChange={(event) =>
              field.onChange(event.target.value === '' ? undefined : event.target.value)
            }
          />
        )}
      />
      <div>
        <Button type="submit">Envoyer la demande</Button>
      </div>
    </Form>
  );
}

const validation = new ApiProblemError(
  {
    type: 'about:blank',
    title: 'Validation failed',
    status: 400,
    code: 'VALIDATION_FAILED',
    errors: [{ pointer: '/note', code: 'too_big' }],
  },
  '01JD7Q2X9ZK3',
);
const limit = new ApiProblemError(
  { type: 'about:blank', title: 'Weekly limit', status: 429, code: 'NETWORK_WEEKLY_REQUEST_LIMIT' },
  '01JD7Q2XA0B4',
);

/** Zod in the browser, with the messages of the catalogues; the first invalid field is focused. */
export const ClientValidation: Story = {
  render: () => <ConnectionForm answer={() => validation} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Envoyer la demande' }));
    const handle = canvas.getByRole('textbox', { name: 'Identifiant du membre' });
    await waitFor(() => expect(handle).toHaveFocus());
    await expect(handle).toBeInvalid();
    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent('Le formulaire contient 1 erreur.'),
    );
  },
};

/** The field error of the api under its field, then an error of the whole form with its reference. */
export const ServerErrors: Story = {
  render: () => <ConnectionForm answer={(attempt) => (attempt === 1 ? validation : limit)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Identifiant du membre' }),
      'kofi-mensah',
    );
    await userEvent.type(canvas.getByRole('textbox', { name: /Note/ }), 'Rencontrés à Lomé.');
    await userEvent.click(canvas.getByRole('button', { name: 'Envoyer la demande' }));
    const note = canvas.getByRole('textbox', { name: /Note/ });
    await waitFor(() => expect(note).toBeInvalid());
    await expect(note).toHaveAccessibleDescription(/Valeur trop grande/);
    await userEvent.click(canvas.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(canvas.getByRole('alert')).toHaveTextContent(/01JD7Q2XA0B4/));
  },
};
