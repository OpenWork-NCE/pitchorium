// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { galleryPost } from '@/stories/compositions/fixtures';
import { renderWithProviders } from '../../../../../test/support/render';
import { PostImages } from './post-images';

vi.mock('embla-carousel-react', () => ({ default: () => [() => undefined, undefined] }));

const named = () =>
  [...document.querySelectorAll<HTMLElement>('img')]
    .map((image) => image.style.viewTransitionName)
    .filter(Boolean);

describe('post images (ADR 0145)', () => {
  it('names no image at rest, even when a publication is shown twice (a repost)', () => {
    renderWithProviders(
      <>
        <PostImages images={galleryPost.images} postId={galleryPost.id} />
        <PostImages images={galleryPost.images} postId={galleryPost.id} />
      </>,
    );
    expect(named()).toEqual([]);
  });

  it('gives the opening transition a name unique to one place, on one element at a time', async () => {
    const names: string[][] = [];
    let finish = () => undefined as void;
    document.startViewTransition = ((update: () => void) => {
      names.push(named());
      update();
      names.push(named());
      return {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished: new Promise<void>((resolve) => (finish = resolve)),
      };
    }) as unknown as Document['startViewTransition'];
    renderWithProviders(
      <>
        <PostImages images={galleryPost.images} postId={galleryPost.id} />
        <PostImages images={galleryPost.images} postId={galleryPost.id} />
      </>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Agrandir l’image 2 sur 5' })[1]!);
    await waitFor(() => expect(names).toHaveLength(2));
    // Old state: the thumbnail only; new state: the image of the viewer only, same name.
    expect(names[0]).toHaveLength(1);
    expect(names[1]).toEqual(names[0]);
    expect(names[0]![0]).toMatch(/^vt-post-/);
    finish();
    await waitFor(() => expect(named()).toEqual([]));
  });
});
