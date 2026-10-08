import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CopyButton } from './copy-button';

const meta = {
  title: 'Design system/Actions/Copy button',
  component: CopyButton,
  args: {
    value: 'https://pitchorium.com/fr/p/ferme-solaire-thies',
    label: 'Copier le lien',
    copiedLabel: 'Lien copié.',
  },
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The icon swaps to a check, the result is announced. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => Promise.resolve(void (copied = text)) },
    });
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copier le lien' }));
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Lien copié.'));
    await expect(copied).toBe(args.value);
  },
};

export const IconOnly: Story = { args: { display: 'icon' } };

/** A refused clipboard (permissions) is said too. */
export const Refused: Story = {
  play: async ({ canvasElement }) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copier le lien' }));
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent(/La copie a échoué/));
  },
};
