import { createTransport, type Transporter } from 'nodemailer';
import { type MailMessage, Mailer, type MailReceipt } from './mailer';

export class SmtpMailer extends Mailer {
  private readonly transporter: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    super();
    this.transporter = createTransport(smtpUrl);
  }

  async send(message: MailMessage): Promise<MailReceipt> {
    const info = await this.transporter.sendMail({ from: this.from, ...message });
    return { messageId: info.messageId };
  }

  close(): void {
    this.transporter.close();
  }
}
