import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bell, MoreHorizontal, Settings } from 'lucide-react';
import NextLink from 'next/link';
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
    // The button names itself: the tooltip only shows its label (aria-hidden).
    const tooltip = () => document.querySelector('[data-radix-popper-content-wrapper]');
    // The tooltip loads at the first hover or focus (ADR 0094).
    await waitFor(() => expect(tooltip()).toHaveTextContent('Notifications'), { timeout: 5000 });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(tooltip()).toBeNull());
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

/** A link with an icon only (`link`): the same name and tooltip, on an anchor. */
export const AsLink: Story = {
  args: { label: 'Paramètres', icon: <Settings />, link: <NextLink href="#settings" /> },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Paramètres' });
    await expect(link).toHaveAttribute('href', '#settings');
    await userEvent.tab();
    await expect(link).toHaveFocus();
    const tooltip = () => document.querySelector('[data-radix-popper-content-wrapper]');
    await waitFor(() => expect(tooltip()).toHaveTextContent('Paramètres'), { timeout: 5000 });
  },
};
