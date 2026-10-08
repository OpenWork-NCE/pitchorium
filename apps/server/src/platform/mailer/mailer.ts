export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Extra headers, for example `List-Unsubscribe` and `List-Unsubscribe-Post` (RFC 8058). */
  headers?: Record<string, string>;
}

export interface MailReceipt {
  messageId: string | undefined;
  /** Recipients left out because their address is suppressed (bounce or complaint). */
  suppressed?: string[];
}

/** Port for sending emails. Templates are rendered beforehand by @pitchorium/emails. */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<MailReceipt>;

  /**
   * Several emails at once (a batch of notifications, ADR 0064), one receipt each in the same
   * order. Transports that can group the sending override it; the default sends one by one.
   */
  async sendMany(messages: readonly MailMessage[]): Promise<MailReceipt[]> {
    const receipts: MailReceipt[] = [];
    for (const message of messages) receipts.push(await this.send(message));
    return receipts;
  }
}
