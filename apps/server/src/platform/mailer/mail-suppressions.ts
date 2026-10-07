import { Injectable } from '@nestjs/common';
import { type MailMessage, Mailer, type MailReceipt } from './mailer';

/** Source of the addresses never written to again (the notifications module, ADR 0062). */
export interface MailSuppressionSource {
  /** The given addresses that are suppressed, lower-cased. */
  suppressed(emails: readonly string[]): Promise<Set<string>>;
}

/** Registry filled at startup by the module owning the suppression list. */
@Injectable()
export class MailSuppressionRegistry {
  private readonly sources: MailSuppressionSource[] = [];

  register(source: MailSuppressionSource): void {
    this.sources.push(source);
  }

  async suppressed(emails: readonly string[]): Promise<Set<string>> {
    const found = new Set<string>();
    for (const source of this.sources) {
      for (const email of await source.suppressed(emails)) found.add(email);
    }
    return found;
  }
}

/** Mailer that leaves suppressed addresses out, then sends through the transport. */
export class SuppressingMailer extends Mailer {
  constructor(
    readonly transport: Mailer,
    private readonly suppressions: MailSuppressionRegistry,
  ) {
    super();
  }

  async send(message: MailMessage): Promise<MailReceipt> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    const suppressed = await this.suppressions.suppressed(
      recipients.map((email) => email.toLowerCase()),
    );
    const kept = recipients.filter((email) => !suppressed.has(email.toLowerCase()));
    const left = recipients.filter((email) => suppressed.has(email.toLowerCase()));
    if (kept.length === 0) return { messageId: undefined, suppressed: left };
    const receipt = await this.transport.send({ ...message, to: kept });
    return left.length > 0 ? { ...receipt, suppressed: left } : receipt;
  }
}
