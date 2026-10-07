import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@pitchorium/contracts';
import {
  type OrganizationNoticeEmailProps,
  renderOrganizationNoticeEmail,
} from '@pitchorium/emails';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { Mailer } from '../../../platform/mailer';

export interface Recipient {
  email: string;
  name: string | null;
  locale: Locale;
}

/** `2026-10-07 09:30`, the emails say it is UTC. */
export function formatUtc(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

/** Organization emails, rendered by @pitchorium/emails, with links to the web app. */
@Injectable()
export class OrganizationMailer {
  constructor(
    private readonly mailer: Mailer,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  organizationUrl(slug: string): string {
    return `${this.config.webAppUrl}/organizations/${slug}`;
  }

  invitationUrl(token: string): string {
    return `${this.config.webAppUrl}/invitations/${token}`;
  }

  async send(
    to: Recipient,
    notice: Omit<OrganizationNoticeEmailProps, 'locale' | 'name'>,
  ): Promise<void> {
    const { subject, html, text } = await renderOrganizationNoticeEmail({
      ...notice,
      locale: to.locale,
      name: to.name,
    });
    await this.mailer.send({ to: to.email, subject, html, text });
  }
}
