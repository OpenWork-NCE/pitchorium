import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LayoutGrid, List } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { ThemeSelector } from './theme-selector';
import { ToggleGroup } from './toggle-group';

const meta = { title: 'Design system/Actions/Toggle group' } satisfies Meta;
export default meta;
type Story = StoryObj;

/** Single choice: the indicator glides between the options (layout animation). */
export const Segmented: Story = {
  render: function Render() {
    const [value, setValue] = useState<'feed' | 'projects' | 'people'>('feed');
    return (
      <ToggleGroup
        type="single"
        label="Vue"
        value={value}
        onValueChange={setValue}
        options={[
          { value: 'feed', label: 'Fil' },
          { value: 'projects', label: 'Projets' },
          { value: 'people', label: 'Personnes' },
        ]}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const feed = canvas.getByRole('radio', { name: 'Fil' });
    await userEvent.click(feed);
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('radio', { name: 'Projets' })).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('radio', { name: 'Projets' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};

export const WithIcons: Story = {
  render: function Render() {
    const [value, setValue] = useState<'grid' | 'list'>('grid');
    return (
      <ToggleGroup
        type="single"
        label="Affichage"
        value={value}
        onValueChange={setValue}
        options={[
          {
            value: 'grid',
            label: (
              <>
                <LayoutGrid aria-hidden /> Grille
              </>
            ),
          },
          {
            value: 'list',
            label: (
              <>
                <List aria-hidden /> Liste
              </>
            ),
          },
        ]}
      />
    );
  },
};

/** Several toggles pressed at once: filters. */
export const Multiple: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>(['funding']);
    return (
      <ToggleGroup
        type="multiple"
        label="État des projets"
        value={value}
        onValueChange={setValue}
        options={[
          { value: 'funding', label: 'En financement' },
          { value: 'funded', label: 'Financés' },
          { value: 'closed', label: 'Clôturés', disabled: true },
        ]}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const funded = canvas.getByRole('button', { name: 'Financés' });
    await userEvent.click(funded);
    await expect(funded).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'En financement' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

export const Theme: Story = { render: () => <ThemeSelector /> };
