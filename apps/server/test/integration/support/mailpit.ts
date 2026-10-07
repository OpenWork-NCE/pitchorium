import { inject, vi } from 'vitest';

interface MailpitSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

export interface ReceivedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Client of the Mailpit REST API (real SMTP server started by the global setup). */
export class Mailpit {
  private readonly baseUrl = inject('mailpitApiUrl');

  async clear(): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/messages`, { method: 'DELETE' });
  }

  async messagesTo(address: string): Promise<MailpitSummary[]> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
    );
    const body = (await response.json()) as { messages: MailpitSummary[] };
    return body.messages;
  }

  /** Waits for an email to `address` whose subject contains `subject`. */
  async waitFor(address: string, subject: string): Promise<ReceivedEmail> {
    const summary = await vi.waitFor(
      async () => {
        const found = (await this.messagesTo(address)).find((message) =>
          message.Subject.includes(subject),
        );
        if (!found) throw new Error(`No email "${subject}" to ${address} yet`);
        return found;
      },
      { timeout: 10_000, interval: 100 },
    );
    const response = await fetch(`${this.baseUrl}/api/v1/message/${summary.ID}`);
    const message = (await response.json()) as { Subject: string; Text: string; HTML: string };
    return { subject: message.Subject, text: message.Text, html: message.HTML };
  }
}

/** First URL of the email text under `prefix`. */
export function linkIn(email: ReceivedEmail, prefix: string): string {
  const match = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\S+`).exec(email.text);
  if (!match) throw new Error(`No link starting with ${prefix} in: ${email.text}`);
  return match[0];
}
