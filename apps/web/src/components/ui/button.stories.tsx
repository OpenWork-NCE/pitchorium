import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ArrowRight } from 'lucide-react';
import { Button } from './button';

const meta = {
  title: 'Design system/Button',
  component: Button,
  args: { children: 'Contribuer au projet' },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'ghost', 'subtle', 'danger'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'icon'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Press scale(0.96); copper disc from the bottom on hover or keyboard focus (H21). */
export const Primary: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary" />
      <Button {...args} variant="secondary" />
      <Button {...args} variant="ghost" />
      <Button {...args} variant="subtle" />
      <Button {...args} variant="danger" />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm" />
      <Button {...args} size="md" />
      <Button {...args} size="lg" />
      <Button {...args} size="icon" aria-label="Suivant">
        <ArrowRight aria-hidden />
      </Button>
    </div>
  ),
};

export const AsLink: Story = {
  render: (args) => (
    <Button {...args} asChild>
      <a href="#projects">Voir les projets</a>
    </Button>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
