/**
 * Schemas of the authentication and security forms, loaded with Zod once the page is idle or at
 * the first check: neither is part of the first load of these screens (ADR 0094, `useZodForm`).
 */
const contracts = () => import('@pitchorium/contracts');

export const emailRequest = () => contracts().then((module) => module.emailRequestSchema);
export const signInRequest = () => contracts().then((module) => module.signInRequestSchema);
export const signUpRequest = () => contracts().then((module) => module.signUpRequestSchema);
export const newPasswordRequest = () =>
  contracts().then((module) => module.newPasswordRequestSchema);
export const totpCodeRequest = () => contracts().then((module) => module.totpCodeRequestSchema);
export const backupCodeRequest = () => contracts().then((module) => module.backupCodeRequestSchema);
export const changePasswordRequest = () =>
  contracts().then((module) => module.changePasswordRequestSchema);
export const passwordConfirmationRequest = () =>
  contracts().then((module) => module.passwordConfirmationRequestSchema);
