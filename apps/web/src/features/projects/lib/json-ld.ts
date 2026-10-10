import type { Project } from '@pitchorium/contracts';
import type { Article, WithContext } from 'schema-dts';

/**
 * Structured data of the public page of a project (ADR 0128): an `Article` of schema.org, the type
 * Google reads for an editorial page (rich results test), with only what the page shows to
 * everyone: its title, its summary, its images, its holder, its publication, its places, and
 * Pitchorium as the publisher. Never an offer or a price: no investment is made on the page.
 */
export function projectJsonLd(
  project: Project,
  options: { url: string; siteUrl: string; locale: string; countries: readonly string[] },
): WithContext<Article> {
  const images = project.gallery.map((image) => image.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: project.title.slice(0, 110),
    ...(project.summary ? { description: project.summary } : {}),
    url: options.url,
    mainEntityOfPage: options.url,
    inLanguage: options.locale,
    // Without a gallery, the icon of the brand: the share image has a hashed address.
    image: images.length > 0 ? images : [`${options.siteUrl}/brand/app-icon-dark-512.png`],
    ...(project.publishedAt ? { datePublished: project.publishedAt } : {}),
    ...(project.updates[0]
      ? { dateModified: project.updates[0].editedAt ?? project.updates[0].publishedAt }
      : project.publishedAt
        ? { dateModified: project.publishedAt }
        : {}),
    author: project.owner
      ? { '@type': 'Person', name: project.owner.displayName }
      : project.organization
        ? { '@type': 'Organization', name: project.organization.name }
        : { '@type': 'Organization', name: 'Pitchorium' },
    publisher: {
      '@type': 'Organization',
      name: 'Pitchorium',
      url: options.siteUrl,
      logo: { '@type': 'ImageObject', url: `${options.siteUrl}/brand/app-icon-dark-512.png` },
    },
    ...(options.countries.length > 0
      ? {
          contentLocation: options.countries.map((name) => ({ '@type': 'Place' as const, name })),
        }
      : {}),
  };
}
