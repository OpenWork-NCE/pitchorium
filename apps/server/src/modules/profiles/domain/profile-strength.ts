import type { ProfileElement, ProfileStrength, ProfileStrengthLevel } from '@pitchorium/contracts';
import type { Profile } from './profile';

/**
 * Provisional weights (sum 100), to be validated (docs/open-questions.md). Order breaks ties
 * between elements of equal weight.
 */
export const PROFILE_STRENGTH_WEIGHTS: Readonly<Record<ProfileElement, number>> = {
  avatar: 15,
  headline: 15,
  bio: 15,
  facet: 15,
  display_name: 10,
  location: 10,
  languages: 5,
  links: 5,
  cover: 5,
  intention: 5,
};

/** Lower bound (in percent) of each level, highest first. */
export const PROFILE_STRENGTH_LEVELS: readonly [ProfileStrengthLevel, number][] = [
  ['complete', 100],
  ['advanced', 70],
  ['intermediate', 40],
  ['beginner', 0],
];

function isPresent(element: ProfileElement, profile: Profile): boolean {
  const { base } = profile;
  switch (element) {
    case 'avatar':
      return base.avatarUrl !== null || base.avatarMediaId !== null;
    case 'display_name':
      return base.displayName.trim() !== '';
    case 'headline':
      return Boolean(base.headline?.trim());
    case 'location':
      return base.countryCode !== null;
    case 'bio':
      return Boolean(base.bio?.trim());
    case 'languages':
      return base.languages.length > 0;
    case 'links':
      return base.links.website !== null || base.links.linkedin !== null;
    case 'cover':
      return base.coverMediaId !== null;
    case 'intention':
      return base.intention !== null;
    case 'facet':
      return profile.entrepreneur !== null || profile.contributor !== null;
  }
}

/** Deterministic: the same profile always gives the same strength. */
export function profileStrength(profile: Profile): ProfileStrength {
  const elements = Object.keys(PROFILE_STRENGTH_WEIGHTS) as ProfileElement[];
  let percent = 0;
  const missing: ProfileElement[] = [];
  for (const element of elements) {
    if (isPresent(element, profile)) percent += PROFILE_STRENGTH_WEIGHTS[element];
    else missing.push(element);
  }
  const level =
    PROFILE_STRENGTH_LEVELS.find(([, minimum]) => percent >= minimum)?.[0] ?? 'beginner';
  return { level, percent, missing };
}
