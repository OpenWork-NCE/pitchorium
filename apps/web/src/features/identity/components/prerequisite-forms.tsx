'use client';

import { lazy } from 'react';
import type { PrerequisiteForms } from '@/features/access';

const forms = () => import('./prerequisite-forms-impl');

/**
 * Elements of the account the member completes without leaving the page (§7.2, step 4), loaded
 * at the first refusal only (ADR 0094).
 */
export const IDENTITY_PREREQUISITE_FORMS: PrerequisiteForms = {
  email_verified: lazy(() => forms().then((module) => ({ default: module.EmailVerifiedForm }))),
  legal_acceptance: lazy(() => forms().then((module) => ({ default: module.LegalForm }))),
  two_factor: lazy(() => forms().then((module) => ({ default: module.TwoFactorForm }))),
};
