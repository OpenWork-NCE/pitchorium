// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../../../test/support/render';
import { autoplayUrl, VideoFacade } from './video-facade';

const youtube = {
  provider: 'youtube' as const,
  videoId: 'dQw4w9WgXcQ',
  embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
};

describe('the facade of the video of a project', () => {
  it('loads nothing of the provider before the click, then its privacy-respecting player', () => {
    const { container } = renderWithProviders(
      <VideoFacade video={youtube} title="Ferme solaire" poster="https://cdn.test/cover.webp" />,
    );
    expect(container.querySelector('iframe')).toBeNull();
    // The poster is the image of the project, never a thumbnail of the provider.
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/cover.webp');
    fireEvent.click(screen.getByRole('button', { name: /Ferme solaire/ }));
    const frame = container.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
    );
    expect(frame?.getAttribute('title')).toContain('YouTube');
    expect(screen.queryByRole('button', { name: /Ferme solaire/ })).toBeNull();
  });

  it('keeps the do-not-track parameter of Vimeo and adds the autoplay', () => {
    expect(autoplayUrl('https://player.vimeo.com/video/76979871?dnt=1')).toBe(
      'https://player.vimeo.com/video/76979871?dnt=1&autoplay=1',
    );
  });
});
