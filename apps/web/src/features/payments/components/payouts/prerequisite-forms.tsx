'use client';

import { lazy } from 'react';
import type { PrerequisiteForms } from '@/features/access';

const forms = () => import('./prerequisite-forms-impl');

/**
 * The payout account and the identity check, refused elsewhere: their prerequisite leads to
 * « Versement et vérification » (ADR 0105), loaded at the first refusal only (ADR 0094).
 */
export const PAYMENTS_PREREQUISITE_FORMS: PrerequisiteForms = {
  payout_account: lazy(() => forms().then((module) => ({ default: module.PayoutAccountForm }))),
  kyc_verified: lazy(() => forms().then((module) => ({ default: module.KycVerifiedForm }))),
};
