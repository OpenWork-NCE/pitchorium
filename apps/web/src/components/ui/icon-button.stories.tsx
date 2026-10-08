import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bell, MoreHorizontal, Settings } from 'lucide-react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { IconButton } from './icon-button';

const meta = {
  title: 'Design system/Actions/Icon button',
  component: IconButton,
  args: { label: 'Notifications', icon: <Bell /> },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Its label is its accessible name and its tooltip, on hover and on keyboard focus. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Notifications' });
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await waitFor(() =>
      expect(within(document.body).getByRole('tooltip')).toHaveTextContent('Notifications'),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('tooltip')).toBeNull());
  },
};

export const Variants: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <IconButton {...args} />
      <IconButton {...args} variant="outline" label="Paramètres" icon={<Settings />} />
      <IconButton
        {...args}
        variant="secondary"
        label="Plus d’actions"
        icon={<MoreHorizontal />}
        size="sm"
      />
      <IconButton
        {...args}
        disabledReason="Bientôt disponible"
        label="Paramètres avancés"
        icon={<Settings />}
      />
    </div>
  ),
};
