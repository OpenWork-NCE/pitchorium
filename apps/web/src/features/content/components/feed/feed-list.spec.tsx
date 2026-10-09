// @vitest-environment jsdom
import type { FeedPage } from '@pitchorium/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Navigation from '@/i18n/navigation';
import { feedPage } from '@/stories/compositions/fixtures';
import { renderWithProviders } from '../../../../../test/support/render';
import { FeedList } from './feed-list';

const report = vi.hoisted(() => vi.fn());
vi.mock('@/lib/observability/report-error', () => ({ reportError: report }));
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

beforeAll(() => {
  // jsdom has no IntersectionObserver nor ResizeObserver: the feed watches nothing here.
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', Observer);
  vi.stubGlobal('ResizeObserver', Observer);
});

const [first] = feedPage.items;

describe('items of the feed', () => {
  it('draws the publications, leaves an event for later and an unknown type out', () => {
    const page = {
      ...feedPage,
      items: [
        first!,
        { type: 'hologram', id: 'hologram:1' },
        {
          type: 'project_update',
          id: 'project_update:1',
          update: {
            id: '0192f4a0-2000-7000-8000-000000009200',
            projectId: '0192f4a0-2000-7000-8000-000000009300',
            author: {
              handle: 'kofi-mensah',
              displayName: 'Kofi Mensah',
              headline: null,
              avatarUrl: null,
            },
            text: 'Premier palier atteint.',
            images: [],
            publishedAt: '2026-10-09T08:00:00.000Z',
            editedAt: null,
            project: {
              id: '0192f4a0-2000-7000-8000-000000009300',
              slug: 'ferme-solaire-thies',
              title: 'Ferme solaire de Thiès',
              coverImageUrl: null,
            },
          },
        },
      ],
    } as unknown as FeedPage;
    renderWithProviders(
      <QueryClientProvider client={new QueryClient()}>
        <FeedList initialPage={page} modules={[]} />
      </QueryClientProvider>,
    );
    const feed = screen.getByRole('feed', { name: 'Fil d’actualité' });
    const articles = [...feed.querySelectorAll('[data-feed-index]')];
    expect(articles.map((article) => article.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^Publication de /),
      'Actualité du projet Ferme solaire de Thiès',
    ]);
    expect(articles.map((article) => article.getAttribute('aria-posinset'))).toEqual(['1', '2']);
    // The unknown type is reported, never shown.
    expect(report).toHaveBeenCalledExactlyOnceWith(
      new Error('Unknown type of feed item: hologram'),
    );
  });
});
