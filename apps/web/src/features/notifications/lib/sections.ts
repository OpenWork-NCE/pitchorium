/**
 * Sections of the grid of the preferences (§10.5), for reading only: the types come from the api
 * (`GET /v1/me/notification-preferences`, its order inside a section), each placed in the first
 * section whose pattern names it; a type no section names goes to « Autres ».
 */
export const PREFERENCE_SECTIONS = [
  ['network', /^(connection_|new_follower|introduction_|profile_views|new_suggestions)/],
  ['posts', /^(reaction|comment|mention|followed_post)$/],
  ['messages', /^message/],
  ['projects', /^(project_|tier_unlocked|contribution_|offline_contribution_|time_entry_|kyc_)/],
  ['organizations', /^organization_/],
  ['events', /^(event_|mission_)/],
  ['account', /^(security_|report_|moderation_|suspension_|appeal_|export_|erasure_)/],
] as const;

export type PreferenceSection = (typeof PREFERENCE_SECTIONS)[number][0] | 'others';

export function sectionsOf<T extends { type: string }>(
  types: readonly T[],
): { section: PreferenceSection; types: T[] }[] {
  const grouped = new Map<PreferenceSection, T[]>();
  for (const item of types) {
    const section = PREFERENCE_SECTIONS.find(([, pattern]) => pattern.test(item.type))?.[0];
    const key = section ?? 'others';
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...PREFERENCE_SECTIONS.map(([section]) => section), 'others' as const]
    .filter((section) => grouped.has(section))
    .map((section) => ({ section, types: grouped.get(section)! }));
}
