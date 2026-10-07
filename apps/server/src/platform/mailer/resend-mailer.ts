import { Resend } from 'resend';
import { type MailMessage, Mailer, type MailReceipt } from './mailer';

export class ResendMailer extends Mailer {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    super();
    this.client = new Resend(apiKey);
  }

  async send(message: MailMessage): Promise<MailReceipt> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
    });
    if (error) {
      throw new Error(`Resend rejected the email: ${error.name}`);
    }
    return { messageId: data?.id };
  }
}
