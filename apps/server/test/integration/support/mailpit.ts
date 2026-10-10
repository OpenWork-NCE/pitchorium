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

/** Budget of an email, from the action that sends it to the mailbox. */
const EMAIL_TIMEOUT_MS = 30_000;

/** Client of the Mailpit REST API (real SMTP server started by the global setup). */
export class Mailpit {
  private readonly baseUrl = inject('mailpitApiUrl');

  async clear(): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/messages`, { method: 'DELETE' });
  }

  /** Number of emails in the mailbox. */
  async count(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/api/v1/messages?limit=1`);
    return ((await response.json()) as { total: number }).total;
  }

  /** Number of emails matching a search of Mailpit (`to:follower-`, for example). */
  async countMatching(search: string): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/search?query=${encodeURIComponent(search)}&limit=1`,
    );
    return ((await response.json()) as { messages_count: number }).messages_count;
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
    const [email] = await this.waitForAll(address, subject, 1);
    if (!email) throw new Error(`No email "${subject}" to ${address}`);
    return email;
  }

  /**
   * Waits for at least `count` emails to `address` whose subject contains `subject`. The budget is
   * that of the other asynchronous waits of the suites: an email leaves after the outbox relay,
   * a job of the worker and an SMTP exchange, each slower on a loaded runner.
   */
  async waitForAll(address: string, subject: string, count: number): Promise<ReceivedEmail[]> {
    const summaries = await vi.waitFor(
      async () => {
        const received = await this.messagesTo(address);
        const found = received.filter((message) => message.Subject.includes(subject));
        if (found.length < count) {
          // What did arrive says whether the email is late, or another one came instead.
          const subjects = received.map((message) => message.Subject).join(' | ') || 'none';
          throw new Error(`Not enough emails "${subject}" to ${address} (received: ${subjects})`);
        }
        return found;
      },
      { timeout: EMAIL_TIMEOUT_MS, interval: 100 },
    );
    return Promise.all(
      summaries.map(async (summary) => {
        const response = await fetch(`${this.baseUrl}/api/v1/message/${summary.ID}`);
        const message = (await response.json()) as { Subject: string; Text: string; HTML: string };
        return { subject: message.Subject, text: message.Text, html: message.HTML };
      }),
    );
  }
}

/** First URL of the email text under `prefix`. */
export function linkIn(email: ReceivedEmail, prefix: string): string {
  const match = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\S+`).exec(email.text);
  if (!match) throw new Error(`No link starting with ${prefix} in: ${email.text}`);
  return match[0];
}
