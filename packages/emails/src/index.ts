import { createElement } from 'react';
import { renderEmail, type RenderedEmail } from './render.js';
import ContributionConfirmationEmail, {
  contributionConfirmationSubject,
  type ContributionConfirmationEmailProps,
} from './templates/contribution-confirmation.js';
import EmailVerificationEmail, {
  emailVerificationSubject,
  type EmailVerificationEmailProps,
} from './templates/email-verification.js';
import MagicLinkEmail, {
  magicLinkSubject,
  type MagicLinkEmailProps,
} from './templates/magic-link.js';
import NewSignInEmail, {
  newSignInSubject,
  type NewSignInEmailProps,
} from './templates/new-sign-in.js';
import OrganizationNoticeEmail, {
  organizationNoticeSubject,
  type OrganizationNoticeEmailProps,
} from './templates/organization-notice.js';
import PasswordResetEmail, {
  passwordResetSubject,
  type PasswordResetEmailProps,
} from './templates/password-reset.js';
import SignInMethodChangedEmail, {
  signInMethodChangedSubject,
  type SignInMethodChangedEmailProps,
} from './templates/sign-in-method-changed.js';
import TechnicalTestEmail, {
  technicalTestSubject,
  type TechnicalTestEmailProps,
} from './templates/technical-test.js';

export type { RenderedEmail } from './render.js';
export type {
  ContributionConfirmationEmailProps,
  ContributionKindLabel,
} from './templates/contribution-confirmation.js';
export type { EmailVerificationEmailProps } from './templates/email-verification.js';
export type { MagicLinkEmailProps } from './templates/magic-link.js';
export type { NewSignInEmailProps } from './templates/new-sign-in.js';
export type {
  OrganizationNoticeEmailProps,
  OrganizationNoticeKind,
  OrganizationRoleLabel,
} from './templates/organization-notice.js';
export type { PasswordResetEmailProps } from './templates/password-reset.js';
export type {
  SignInMethodChange,
  SignInMethodChangedEmailProps,
} from './templates/sign-in-method-changed.js';
export type { TechnicalTestEmailProps } from './templates/technical-test.js';

export function renderTechnicalTestEmail(props: TechnicalTestEmailProps): Promise<RenderedEmail> {
  return renderEmail(technicalTestSubject(props.locale), createElement(TechnicalTestEmail, props));
}

export function renderEmailVerificationEmail(
  props: EmailVerificationEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(
    emailVerificationSubject(props.locale),
    createElement(EmailVerificationEmail, props),
  );
}

export function renderMagicLinkEmail(props: MagicLinkEmailProps): Promise<RenderedEmail> {
  return renderEmail(magicLinkSubject(props.locale), createElement(MagicLinkEmail, props));
}

export function renderPasswordResetEmail(props: PasswordResetEmailProps): Promise<RenderedEmail> {
  return renderEmail(passwordResetSubject(props.locale), createElement(PasswordResetEmail, props));
}

export function renderNewSignInEmail(props: NewSignInEmailProps): Promise<RenderedEmail> {
  return renderEmail(newSignInSubject(props.locale), createElement(NewSignInEmail, props));
}

export function renderSignInMethodChangedEmail(
  props: SignInMethodChangedEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(
    signInMethodChangedSubject(props.locale),
    createElement(SignInMethodChangedEmail, props),
  );
}

export function renderOrganizationNoticeEmail(
  props: OrganizationNoticeEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(
    organizationNoticeSubject(props),
    createElement(OrganizationNoticeEmail, props),
  );
}

export function renderContributionConfirmationEmail(
  props: ContributionConfirmationEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(
    contributionConfirmationSubject(props),
    createElement(ContributionConfirmationEmail, props),
  );
}
