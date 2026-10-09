/**
 * Schemas of the forms of organisations, loaded with Zod once the page is idle or at the first
 * check: neither is part of the first load of these pages (ADR 0094, `useZodForm`).
 */
const contracts = () => import('@pitchorium/contracts');

export const createOrganizationRequest = () =>
  contracts().then((module) => module.createOrganizationRequestSchema);
export const updateOrganizationRequest = () =>
  contracts().then((module) => module.updateOrganizationRequestSchema);
export const changeOrganizationSlugRequest = () =>
  contracts().then((module) => module.changeOrganizationSlugRequestSchema);
export const createInvitationRequest = () =>
  contracts().then((module) => module.createInvitationRequestSchema);
export const createVerificationRequest = () =>
  contracts().then((module) => module.createVerificationRequestSchema);
