'use client';

import { lazy } from 'react';
import type { PrerequisiteForms } from '@/features/access';

const forms = () => import('./prerequisite-forms-impl');

/**
 * The facets a member completes when an action needs them (§7.2, step 4; ADR 0105): the form of
 * the profile opens in the dialog of the prerequisites, then the action resumes. Loaded at the
 * first refusal only (ADR 0094).
 */
export const PROFILE_PREREQUISITE_FORMS: PrerequisiteForms = {
  'profile.entrepreneur_facet': lazy(() =>
    forms().then((module) => ({ default: module.EntrepreneurFacetForm })),
  ),
  'profile.contributor_facet': lazy(() =>
    forms().then((module) => ({ default: module.ContributorFacetForm })),
  ),
};
