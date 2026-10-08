import { createTransport, type Transporter } from 'nodemailer';
import { type MailMessage, Mailer, type MailReceipt } from './mailer';

const SMTP_CONNECTIONS = 5;

export class SmtpMailer extends Mailer {
  private readonly transporter: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    super();
    // Pooled connections: a batch of notifications reuses them (ADR 0064).
    this.transporter = createTransport(
      `${smtpUrl}${smtpUrl.includes('?') ? '&' : '?'}pool=true&maxConnections=${SMTP_CONNECTIONS}`,
    );
  }

  async send(message: MailMessage): Promise<MailReceipt> {
    const info = await this.transporter.sendMail({ from: this.from, ...message });
    return { messageId: info.messageId };
  }

  /** In parallel over the pooled connections. */
  override sendMany(messages: readonly MailMessage[]): Promise<MailReceipt[]> {
    return Promise.all(messages.map((message) => this.send(message)));
  }

  close(): void {
    this.transporter.close();
  }
}
