import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Alert } from './alert';
import { Banner } from './banner';
import { Button } from './button';
import { Callout } from './callout';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { Progress } from './progress';
import { Loading, Skeleton } from './skeleton';
import { Spinner } from './spinner';
import { Toaster } from './toaster';

const meta = { title: 'Design system/Feedback' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Toasts: Story = {
  render: () => (
    <>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => toast.success('Demande de connexion envoyée.')}>Succès</Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.error('L’envoi a échoué.', { description: 'Réessayez dans un instant.' })
          }
        >
          Erreur
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast('Publication enregistrée.', {
              action: { label: 'Annuler', onClick: () => undefined },
            })
          }
        >
          Avec action
        </Button>
      </div>
      <Toaster />
    </>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Succès' }));
    await waitFor(() =>
      expect(within(document.body).getByText('Demande de connexion envoyée.')).toBeVisible(),
    );
  },
};

export const Alerts: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-3">
      <Alert tone="info" title="Paiement en cours de vérification">
        Le prestataire confirme en général en quelques minutes.
      </Alert>
      <Alert tone="success" title="Palier atteint">
        Un palier atteint n’est pas une garantie de succès de la campagne.
      </Alert>
      <Alert
        tone="warning"
        title="KYC à compléter"
        action={
          <Button size="sm" variant="outline">
            Compléter
          </Button>
        }
      >
        Les versements restent en attente jusque-là.
      </Alert>
      <Alert tone="danger" title="Paiement refusé">
        Votre banque a refusé l’opération.
      </Alert>
      <Callout title="Comment ce score est calculé">
        Chaque critère est noté de 0 à 5 par le porteur, puis pondéré.
      </Callout>
    </div>
  ),
};

/** Messages of the account and of the site, across the top of the member space. */
export const Banners: StoryObj<{ onDismiss: () => void }> = {
  args: { onDismiss: fn() },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="grid gap-px">
      <Banner
        tone="warning"
        action={
          <Button size="sm" variant="outline">
            Renvoyer l’email
          </Button>
        }
      >
        Vérifiez votre adresse email pour publier et contribuer.
      </Banner>
      <Banner tone="info" action={<Button size="sm">Lire et accepter</Button>}>
        Les conditions d’utilisation ont changé.
      </Banner>
      <Banner tone="danger">Votre compte est suspendu jusqu’au 20 octobre 2026.</Banner>
      <Banner tone="neutral" live="status" onDismiss={args.onDismiss}>
        Vous êtes hors ligne. Vos actions partiront au retour de la connexion.
      </Banner>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Masquer ce message' }),
    );
    await expect(args.onDismiss).toHaveBeenCalledOnce();
  },
};

/** Shaped like the content to come; still with less motion. */
export const Skeletons: Story = {
  render: () => (
    <Loading className="grid max-w-md gap-4">
      {[0, 1].map((index) => (
        <div key={index} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </Loading>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Chargement en cours',
    );
  },
};

export const Progresses: Story = {
  render: function Render() {
    const [value, setValue] = useState(30);
    return (
      <div className="grid max-w-md gap-4">
        <Progress value={value} label="Envoi du document" valueText={`${value} %`} />
        <Progress value={null} label="Vérification en cours" size="sm" />
        <div className="flex items-center gap-3 text-sm">
          <Spinner label="Chargement" /> <Spinner size="sm" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setValue(Math.min(100, value + 30))}>
          Avancer
        </Button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Avancer' }));
    await expect(canvas.getByRole('progressbar', { name: 'Envoi du document' })).toHaveAttribute(
      'aria-valuetext',
      '60 %',
    );
  },
};

export const EmptyAndError: StoryObj<{ onRetry: () => void }> = {
  args: { onRetry: fn() },
  render: (args) => (
    <div className="grid max-w-2xl gap-6">
      <EmptyState
        icon={<MessagesSquare />}
        title="Aucune conversation pour l’instant"
        description="Écrivez à une de vos connexions : vos échanges apparaîtront ici."
        action={<Button>Nouveau message</Button>}
      />
      <ErrorState onRetry={args.onRetry} reference="01JD7Q2X9ZK3" headingLevel={3} />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent('Référence : 01JD7Q2X9ZK3');
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
