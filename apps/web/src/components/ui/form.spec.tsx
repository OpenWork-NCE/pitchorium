// @vitest-environment jsdom
import { ApiProblemError } from '@pitchorium/api-client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { renderWithProviders } from '../../../test/support/render';
import { Button } from './button';
import { Form, FormActions, FormField, useApplyProblem, useZodForm } from './form';
import { Input } from './input';

const schema = z.object({
  title: z.string().trim().min(1).max(20),
  website: z.url({ protocol: /^https$/ }),
  endsAt: z.string().optional(),
});

function EventForm({ answer }: { answer?: ApiProblemError }) {
  const form = useZodForm(schema, { defaultValues: { title: '', website: '', endsAt: '' } });
  const applyProblem = useApplyProblem(form, {
    fields: { EVENTS_SCHEDULE_INVALID: { field: 'endsAt', values: { days: 14 } } },
  });
  return (
    <Form form={form} onSubmit={() => answer && applyProblem(answer)}>
      <FormField
        name="title"
        label="Titre"
        maxLength={20}
        render={({ field }) => <Input {...field} />}
      />
      <FormField name="website" label="Site" render={({ field }) => <Input {...field} />} />
      <FormField
        name="endsAt"
        label="Fin"
        optional
        render={({ field }) => <Input {...field} value={String(field.value ?? '')} />}
      />
      <FormActions>
        <Button type="submit">Publier</Button>
        <Button variant="outline">Enregistrer le brouillon</Button>
      </FormActions>
    </Form>
  );
}

const nextFrame = () => act(() => new Promise((resolve) => requestAnimationFrame(resolve)));

describe('Form', () => {
  it('lists every error with a link to its field, and gives the summary the focus', async () => {
    renderWithProviders(<EventForm />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Site' }), {
      target: { value: 'http://example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    const summary = await screen.findByRole('group', { name: 'Le formulaire contient 2 erreurs.' });
    await nextFrame();
    expect(document.activeElement).toBe(summary);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Titre : Renseignez ce champ.',
      'Site : Saisissez l’adresse complète du site, commençant par https:// (http:// n’est pas accepté).',
    ]);
    fireEvent.click(links[1]!);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Site' }));
  });

  it('puts a code of the api about one field under that field, with its precise message', async () => {
    renderWithProviders(
      <EventForm
        answer={
          new ApiProblemError(
            { type: 'about:blank', title: 'x', status: 422, code: 'EVENTS_SCHEDULE_INVALID' },
            'REF1',
          )
        }
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre' }), {
      target: { value: 'Atelier' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Site' }), {
      target: { value: 'https://example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    await waitFor(() =>
      expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Fin : Vérifiez les dates : la fin doit être après le début, l’événement dure 14 jours au plus et ne peut pas être déjà terminé.',
      ]),
    );
  });

  it('says another problem of the api for the whole form, with its reference', async () => {
    renderWithProviders(
      <EventForm
        answer={
          new ApiProblemError(
            { type: 'about:blank', title: 'x', status: 429, code: 'RATE_LIMITED' },
            '01JD7Q',
          )
        }
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre' }), {
      target: { value: 'Atelier' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Site' }), {
      target: { value: 'https://example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    const summary = await screen.findByRole('group', { name: 'L’envoi n’a pas abouti.' });
    expect(summary.textContent).toContain('(référence : 01JD7Q)');
  });

  it('shows the counter from 80 % of the limit, otherwise while the field has the focus', () => {
    renderWithProviders(<EventForm />);
    const title = screen.getByRole('textbox', { name: 'Titre' });
    // Far from the limit: hidden, shown by `:focus-within` only.
    expect(screen.getByText('0 sur 20 caractères').className).toContain(
      'group-focus-within/field:block',
    );
    fireEvent.change(title, { target: { value: 'Atelier de trésor' } });
    const near = screen.getByText('17 sur 20 caractères');
    expect(near.className).not.toContain('hidden');
    expect(near.hasAttribute('data-near')).toBe(true);
  });

  it('puts the main action first in the document', () => {
    renderWithProviders(<EventForm />);
    expect(screen.getAllByRole('button')).toEqual([
      screen.getByRole('button', { name: 'Publier' }),
      screen.getByRole('button', { name: 'Enregistrer le brouillon' }),
    ]);
  });
});
