'use client';

import type { PrerequisiteForms } from '@/features/access';
import { IDENTITY_PREREQUISITE_FORMS } from '@/features/identity';
import { PROFILE_PREREQUISITE_FORMS } from '@/features/profiles';

/**
 * Every element of the api the member space completes in place (ADR 0105): those of the account
 * (identity) and the facets of the profile (profiles). Gathered on the client side: the forms
 * are client components.
 */
export const MEMBER_PREREQUISITE_FORMS: PrerequisiteForms = {
  ...IDENTITY_PREREQUISITE_FORMS,
  ...PROFILE_PREREQUISITE_FORMS,
};
