import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BrandLogo, BrandMicro, BrandSymbol } from './brand-mark';

const meta = { title: 'Brand/Marks' } satisfies Meta;
export default meta;

/** Official marks, one inline SVG per mark: violet on light, brand white on dark. */
export const Marks: StoryObj = {
  render: () => (
    <div className="grid gap-8">
      <BrandLogo label="Pitchorium" />
      <BrandLogo label="Pitchorium" animated />
      <div className="flex items-end gap-6">
        <BrandSymbol label="Pitchorium" />
        <BrandSymbol label="Pitchorium" width={128} />
      </div>
      <div className="flex items-end gap-4">
        <BrandMicro size={16} label="Pitchorium" />
        <BrandMicro size={24} label="Pitchorium" />
        <BrandMicro size={32} label="Pitchorium" />
      </div>
    </div>
  ),
};
