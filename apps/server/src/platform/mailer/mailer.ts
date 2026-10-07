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
}
