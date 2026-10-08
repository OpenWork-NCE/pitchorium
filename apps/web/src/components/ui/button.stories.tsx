import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './button';

const meta = {
  title: 'Design system/Actions/Button',
  component: Button,
  args: { children: 'Contribuer au projet', onClick: fn() },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger', 'link'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Press scale(0.96); copper disc from the bottom on hover or keyboard focus (H21). */
export const Primary: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Contribuer au projet' });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
    await expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary" />
      <Button {...args} variant="secondary">
        Suivre
      </Button>
      <Button {...args} variant="outline">
        Annuler
      </Button>
      <Button {...args} variant="ghost">
        Plus tard
      </Button>
      <Button {...args} variant="danger">
        <Trash2 aria-hidden />
        Supprimer
      </Button>
      <Button {...args} variant="link">
        Voir les conditions
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">
        <Plus aria-hidden />
        Publier
      </Button>
      <Button {...args} size="md" />
      <Button {...args} size="lg">
        Créer un projet
        <ArrowRight aria-hidden />
      </Button>
    </div>
  ),
};

/** The label stays in place under the spinner: the button keeps its width. */
export const Loading: Story = {
  render: function Render(args) {
    const [loading, setLoading] = useState(false);
    return (
      <Button
        {...args}
        loading={loading}
        loadingLabel="Envoi en cours"
        onClick={() => setLoading(true)}
      >
        Envoyer la demande
      </Button>
    );
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Envoyer la demande' });
    const width = button.getBoundingClientRect().width;
    await userEvent.click(button);
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(within(button).getByRole('status')).toHaveTextContent('Envoi en cours');
    await expect(button.getBoundingClientRect().width).toBe(width);
  },
};

export const Disabled: Story = { args: { disabled: true } };

/** Still focusable, the reason is announced and shown in a tooltip; the click does nothing. */
export const DisabledWithReason: Story = {
  args: { disabledReason: 'Vérifiez votre adresse email pour contribuer.' },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Contribuer au projet' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveAccessibleDescription(
      'Vérifiez votre adresse email pour contribuer.',
    );
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const AsLink: Story = {
  render: (args) => (
    <Button {...args} asChild>
      <a href="#projects">Voir les projets</a>
    </Button>
  ),
};
