import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { FileDrop, type FileDropItem } from './file-drop';

const meta = { title: 'Design system/Forms/File drop', component: FileDrop } satisfies Meta<
  typeof FileDrop
>;
export default meta;
type Story = StoryObj;

const LIMITS = 'JPEG, PNG ou WebP, 8 Mo au plus, 1 584 × 396 pixels conseillés.';

/** Every state of the checks of the api, with the reason of a refusal. */
export const States: Story = {
  render: () => (
    <div className="max-w-xl">
      <FileDrop
        label="Documents du projet"
        limits="PDF, 20 Mo et 30 pages au plus."
        accept={['application/pdf']}
        multiple
        onFiles={() => undefined}
        onRemove={() => undefined}
        onRetry={() => undefined}
        items={[
          { id: '1', name: 'pitch-deck.pdf', size: 2_400_000, state: 'pending' },
          { id: '2', name: 'business-plan.pdf', size: 5_100_000, state: 'uploading', progress: 42 },
          { id: '3', name: 'statuts.pdf', size: 860_000, state: 'processing' },
          { id: '4', name: 'one-pager.pdf', size: 320_000, state: 'ready' },
          {
            id: '5',
            name: 'scan-illisible.pdf',
            size: 12_000_000,
            state: 'rejected',
            reason: 'PDF illisible',
          },
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('progressbar', { name: 'Envoi de business-plan.pdf' }),
    ).toHaveAttribute('aria-valuenow', '42');
    await expect(canvas.getByText(/Refusé : PDF illisible/)).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Réessayer l’envoi de scan-illisible.pdf' }),
    ).toBeVisible();
  },
};

/** The picker, drag and drop, and paste all hand the files over. */
export const Picker: Story = {
  render: function Render() {
    const [items, setItems] = useState<FileDropItem[]>([]);
    return (
      <div className="max-w-xl">
        <FileDrop
          label="Photo de couverture"
          limits={LIMITS}
          accept={['image/jpeg', 'image/png', 'image/webp']}
          items={items}
          onFiles={(files) =>
            setItems(
              files.map((file) => ({
                id: file.name,
                name: file.name,
                size: file.size,
                state: 'pending',
              })),
            )
          }
          onRemove={(id) => setItems((current) => current.filter((item) => item.id !== id))}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('group', { name: 'Photo de couverture' }),
    ).toHaveAccessibleDescription(/8 Mo au plus/);
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input');
    await userEvent.upload(input, new File(['x'], 'couverture.png', { type: 'image/png' }));
    await expect(canvas.getByText('couverture.png')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Retirer couverture.png' }));
    await expect(canvas.queryByText('couverture.png')).toBeNull();
  },
};
