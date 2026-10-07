export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface MailReceipt {
  messageId: string | undefined;
}

/** Port for sending emails. Templates are rendered beforehand by @pitchorium/emails. */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<MailReceipt>;
}
