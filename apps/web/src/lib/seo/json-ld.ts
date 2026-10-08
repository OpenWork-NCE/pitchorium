import type { Thing, WithContext } from 'schema-dts';

/**
 * Serialises structured data for a `<script type="application/ld+json">`: `<` is escaped so that
 * no value can close the script element.
 */
export function jsonLd(data: WithContext<Thing>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
