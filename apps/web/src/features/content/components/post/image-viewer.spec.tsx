// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { galleryPost } from '@/stories/compositions/fixtures';
import { renderWithProviders } from '../../../../../test/support/render';
import ImageViewer from './image-viewer';

vi.mock('embla-carousel-react', () => ({
  // The carousel not ready yet: its code loads with the viewer.
  default: () => [() => undefined, undefined],
}));

describe('image viewer', () => {
  it('keeps an arrow pressed before the carousel is ready', () => {
    renderWithProviders(
      <ImageViewer
        images={galleryPost.images}
        startIndex={0}
        transitionName="viewer"
        onClose={() => undefined}
      />,
    );
    const viewer = screen.getByRole('dialog');
    expect(viewer.textContent).toContain('1 / 5');
    fireEvent.keyDown(viewer, { key: 'ArrowRight' });
    expect(viewer.textContent).toContain('2 / 5');
    fireEvent.keyDown(viewer, { key: 'ArrowLeft' });
    fireEvent.keyDown(viewer, { key: 'ArrowLeft' });
    expect(viewer.textContent).toContain('1 / 5');
  });
});
