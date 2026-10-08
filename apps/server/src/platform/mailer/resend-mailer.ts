import { type CreateEmailOptions, Resend } from 'resend';
import { type MailMessage, Mailer, type MailReceipt } from './mailer';

/** Emails per call of the batch endpoint of Resend. */
const RESEND_BATCH_SIZE = 100;

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
    const { data, error } = await this.client.emails.send(this.options(message));
    if (error) {
      throw new Error(`Resend rejected the email: ${error.name}`);
    }
    return { messageId: data?.id };
  }

  /** Batch endpoint, 100 emails per call; a refused call fails the whole call. */
  override async sendMany(messages: readonly MailMessage[]): Promise<MailReceipt[]> {
    const receipts: MailReceipt[] = [];
    for (let start = 0; start < messages.length; start += RESEND_BATCH_SIZE) {
      const chunk = messages.slice(start, start + RESEND_BATCH_SIZE);
      const { data, error } = await this.client.batch.send(chunk.map((m) => this.options(m)));
      if (error) {
        throw new Error(`Resend rejected the batch: ${error.name}`);
      }
      receipts.push(...chunk.map((_, index) => ({ messageId: data?.data[index]?.id })));
    }
    return receipts;
  }

  private options(message: MailMessage): CreateEmailOptions {
    return {
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
    };
  }
}
