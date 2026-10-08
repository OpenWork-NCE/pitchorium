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
    const [receipt] = await this.sendMany([message]);
    return receipt ?? { messageId: undefined };
  }

  /** One lookup of the suppression list for the whole batch, then one grouped sending. */
  override async sendMany(messages: readonly MailMessage[]): Promise<MailReceipt[]> {
    const recipientsOf = (message: MailMessage) =>
      Array.isArray(message.to) ? message.to : [message.to];
    const suppressed = await this.suppressions.suppressed([
      ...new Set(messages.flatMap((message) => recipientsOf(message).map((e) => e.toLowerCase()))),
    ]);
    const plans = messages.map((message) => {
      const recipients = recipientsOf(message);
      return {
        message,
        kept: recipients.filter((email) => !suppressed.has(email.toLowerCase())),
        left: recipients.filter((email) => suppressed.has(email.toLowerCase())),
      };
    });
    const sendable = plans.filter((plan) => plan.kept.length > 0);
    const sent = await this.transport.sendMany(
      sendable.map((plan) => ({ ...plan.message, to: plan.kept })),
    );
    return plans.map((plan): MailReceipt => {
      if (plan.kept.length === 0) return { messageId: undefined, suppressed: plan.left };
      const receipt = sent[sendable.indexOf(plan)] ?? { messageId: undefined };
      return plan.left.length > 0 ? { ...receipt, suppressed: plan.left } : receipt;
    });
  }
}
