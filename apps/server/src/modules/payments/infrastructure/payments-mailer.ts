import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@pitchorium/contracts';
import {
  type ContributionConfirmationEmailProps,
  renderContributionConfirmationEmail,
} from '@pitchorium/emails';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { Mailer } from '../../../platform/mailer';

/** `2026-10-07 09:30`, the email says it is UTC. */
export function formatUtc(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

/** Payments emails, rendered by @pitchorium/emails, with links to the web app. */
@Injectable()
export class PaymentsMailer {
  constructor(
    private readonly mailer: Mailer,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  projectUrl(slug: string): string {
    return `${this.config.webAppUrl}/projects/${slug}`;
  }

  async sendConfirmation(
    to: { email: string; name: string; locale: Locale },
    content: Omit<ContributionConfirmationEmailProps, 'locale' | 'name'>,
  ): Promise<void> {
    const { subject, html, text } = await renderContributionConfirmationEmail({
      ...content,
      locale: to.locale,
      name: to.name,
    });
    await this.mailer.send({ to: to.email, subject, html, text });
  }
}
