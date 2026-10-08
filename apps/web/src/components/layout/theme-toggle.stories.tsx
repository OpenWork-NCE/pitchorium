import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ThemeToggle } from './theme-toggle';

const meta = { title: 'Motion/Theme toggle', component: ThemeToggle } satisfies Meta<
  typeof ThemeToggle
>;
export default meta;

/** H14 level 3: the new theme grows as a circle from the button (a fade with less motion). */
export const Default: StoryObj<typeof meta> = {};
