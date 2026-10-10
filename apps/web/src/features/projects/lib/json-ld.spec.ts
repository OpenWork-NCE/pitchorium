import { describe, expect, it } from 'vitest';
import { projectJsonLd } from './json-ld';

const project = {
  title: 'Ferme solaire coopérative de Thiès',
  summary: 'Des pompes solaires pour les maraîchers.',
  gallery: [{ mediaId: 'a', url: 'https://cdn.test/a.webp', variants: {}, alt: null }],
  publishedAt: '2026-09-01T09:00:00.000Z',
  updates: [{ publishedAt: '2026-09-20T09:00:00.000Z', editedAt: null }],
  owner: { handle: 'aissatou-ba', displayName: 'Aïssatou Ba', headline: null, avatarUrl: null },
  organization: null,
} as unknown as Parameters<typeof projectJsonLd>[0];

describe('structured data of a project', () => {
  it('describes the public page as an article of its holder, published by Pitchorium', () => {
    expect(
      projectJsonLd(project, {
        url: 'https://pitchorium.example/fr/projects/ferme-solaire',
        siteUrl: 'https://pitchorium.example',
        locale: 'fr',
        countries: ['Sénégal'],
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Ferme solaire coopérative de Thiès',
      description: 'Des pompes solaires pour les maraîchers.',
      url: 'https://pitchorium.example/fr/projects/ferme-solaire',
      mainEntityOfPage: 'https://pitchorium.example/fr/projects/ferme-solaire',
      inLanguage: 'fr',
      image: ['https://cdn.test/a.webp'],
      datePublished: '2026-09-01T09:00:00.000Z',
      dateModified: '2026-09-20T09:00:00.000Z',
      author: { '@type': 'Person', name: 'Aïssatou Ba' },
      publisher: {
        '@type': 'Organization',
        name: 'Pitchorium',
        url: 'https://pitchorium.example',
        logo: {
          '@type': 'ImageObject',
          url: 'https://pitchorium.example/brand/app-icon-dark-512.png',
        },
      },
      contentLocation: [{ '@type': 'Place', name: 'Sénégal' }],
    });
  });

  it('falls back on its share image without a gallery', () => {
    const data = projectJsonLd(
      { ...project, gallery: [] },
      {
        url: 'https://p.example/fr/projects/x',
        siteUrl: 'https://p.example',
        locale: 'fr',
        countries: [],
      },
    );
    expect(data.image).toEqual(['https://p.example/brand/app-icon-dark-512.png']);
    expect(data).not.toHaveProperty('contentLocation');
  });
});
