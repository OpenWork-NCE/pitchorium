import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@pitchorium/contracts';
import {
  type RenderedEmail,
  renderEmailVerificationEmail,
  renderMagicLinkEmail,
  renderNewSignInEmail,
  renderPasswordResetEmail,
  renderSignInMethodChangedEmail,
  type SignInMethodChange,
} from '@pitchorium/emails';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { Mailer } from '../../../platform/mailer';

export const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 3600;
export const MAGIC_LINK_TTL_SECONDS = 15 * 60;
export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

interface Recipient {
  email: string;
  name: string;
  locale: Locale;
}

/** `2026-10-07 09:30`, the emails say it is UTC. */
function formatUtc(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

/** Transactional emails of the identity module, rendered by @pitchorium/emails. */
@Injectable()
export class IdentityMailer {
  constructor(
    private readonly mailer: Mailer,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  private get securityUrl(): string {
    return `${this.config.webAppUrl}/settings/security`;
  }

  sendEmailVerification(to: Recipient, url: string): Promise<void> {
    return this.send(
      to.email,
      renderEmailVerificationEmail({
        locale: to.locale,
        name: to.name,
        url,
        expiresInHours: EMAIL_VERIFICATION_TTL_SECONDS / 3600,
      }),
    );
  }

  sendMagicLink(email: string, locale: Locale, url: string): Promise<void> {
    return this.send(
      email,
      renderMagicLinkEmail({ locale, url, expiresInMinutes: MAGIC_LINK_TTL_SECONDS / 60 }),
    );
  }

  sendPasswordReset(to: Recipient, url: string): Promise<void> {
    return this.send(
      to.email,
      renderPasswordResetEmail({
        locale: to.locale,
        name: to.name,
        url,
        expiresInMinutes: PASSWORD_RESET_TTL_SECONDS / 60,
      }),
    );
  }

  sendNewSignIn(to: Recipient, signedInAt: Date, device: string): Promise<void> {
    return this.send(
      to.email,
      renderNewSignInEmail({
        locale: to.locale,
        name: to.name,
        signedInAt: formatUtc(signedInAt),
        device,
        securityUrl: this.securityUrl,
      }),
    );
  }

  sendSignInMethodChanged(
    to: Recipient,
    change: SignInMethodChange,
    provider: string,
    changedAt: Date,
  ): Promise<void> {
    return this.send(
      to.email,
      renderSignInMethodChangedEmail({
        locale: to.locale,
        name: to.name,
        change,
        provider,
        changedAt: formatUtc(changedAt),
        securityUrl: this.securityUrl,
      }),
    );
  }

  private async send(to: string, rendering: Promise<RenderedEmail>): Promise<void> {
    const { subject, html, text } = await rendering;
    await this.mailer.send({ to, subject, html, text });
  }
}
