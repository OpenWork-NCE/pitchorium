import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { SegmentedControl } from './segmented-control';

const meta = {
  title: 'Design system/Segmented control',
  component: SegmentedControl,
} satisfies Meta<typeof SegmentedControl>;

export default meta;

/** The active item is marked by the shared indicator (Motion layoutId), which glides. */
export const Default: StoryObj = {
  render: function Render() {
    const [value, setValue] = useState<'feed' | 'projects' | 'people'>('feed');
    return (
      <SegmentedControl
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
};
