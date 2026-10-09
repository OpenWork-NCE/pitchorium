import type { ProfileView } from '@pitchorium/contracts';
import type { Person, WithContext } from 'schema-dts';

/**
 * Structured data of a public page of a member (JSON-LD `Person`): only what the page itself
 * shows to everyone, its name, title, photo, address and links.
 */
export function personJsonLd(profile: ProfileView, url: string): WithContext<Person> {
  const links = [profile.links.website, profile.links.linkedin].filter(
    (link): link is string => link !== null,
  );
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.displayName,
    url,
    ...(profile.headline ? { jobTitle: profile.headline } : {}),
    ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
    ...(links.length > 0 ? { sameAs: links } : {}),
  };
}
