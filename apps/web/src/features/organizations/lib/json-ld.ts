import type { Organization } from '@pitchorium/contracts';
import type { Organization as OrganizationLd, WithContext } from 'schema-dts';

/**
 * Structured data of the public page of an organisation (JSON-LD `Organization`): what the page
 * shows to everyone, its name, presentation, logo, site, year and countries.
 */
export function organizationJsonLd(
  organization: Organization,
  url: string,
): WithContext<OrganizationLd> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: organization.name,
    url,
    ...(organization.description ? { description: organization.description } : {}),
    ...(organization.logoUrl ? { logo: organization.logoUrl } : {}),
    ...(organization.websiteUrl ? { sameAs: [organization.websiteUrl] } : {}),
    ...(organization.foundedYear ? { foundingDate: String(organization.foundedYear) } : {}),
    ...(organization.countryCodes.length > 0
      ? {
          areaServed: organization.countryCodes.map((code) => ({
            '@type': 'Country' as const,
            identifier: code,
          })),
        }
      : {}),
  };
}
