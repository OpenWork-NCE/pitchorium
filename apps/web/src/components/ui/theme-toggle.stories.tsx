import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { ThemeToggle } from './theme-toggle';

const meta = {
  title: 'Design system/Navigation/Theme toggle',
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>;
export default meta;

/** H14 level 3: the new theme grows as a circle from the button (a fade with less motion). */
export const Default: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /Passer au thème/ }),
    ).toBeVisible();
  },
};
