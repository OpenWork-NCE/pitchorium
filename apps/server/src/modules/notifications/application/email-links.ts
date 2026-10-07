import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type NotificationType, notificationTypeSchema } from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';

/** What a one-click unsubscribe turns off: the email of a type, or the digest. */
export type UnsubscribeScope = NotificationType | 'digest';

/**
 * Links of the emails (ADR 0062): signed unsubscribe tokens (HMAC SHA-256 with
 * EMAIL_LINK_SECRET) that need no session, for the `List-Unsubscribe` header (RFC 8058, POST
 * to the api) and for the page of the web app linked in the footer.
 */
@Injectable()
export class EmailLinks {
  constructor(@Inject(COMMON_CONFIG) private readonly config: CommonConfig) {}

  unsubscribeToken(userId: string, scope: UnsubscribeScope): string {
    const body = Buffer.from(JSON.stringify({ u: userId, s: scope })).toString('base64url');
    return `${body}.${this.sign(body)}`;
  }

  verify(token: string): { userId: string; scope: UnsubscribeScope } | null {
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
        u?: unknown;
        s?: unknown;
      };
      if (typeof parsed.u !== 'string') return null;
      if (parsed.s === 'digest') return { userId: parsed.u, scope: 'digest' };
      const type = notificationTypeSchema.safeParse(parsed.s);
      return type.success ? { userId: parsed.u, scope: type.data } : null;
    } catch {
      return null;
    }
  }

  /** Headers of a non-transactional email: one-click unsubscribe by POST (RFC 8058). */
  unsubscribeHeaders(token: string): Record<string, string> {
    return {
      'List-Unsubscribe': `<${this.config.apiPublicUrl}/v1/notifications/unsubscribe?token=${token}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }

  unsubscribePage(token: string): string {
    return `${this.config.webAppUrl}/notifications/unsubscribe?token=${token}`;
  }

  webUrl(path: string): string {
    return `${this.config.webAppUrl}${path}`;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.config.emailLinkSecret).update(body).digest('base64url');
  }
}
