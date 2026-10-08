import { Injectable } from '@nestjs/common';
import { renderPlatformNoticeEmail } from '@pitchorium/emails';
import { Mailer } from '../../../platform/mailer';
import { TrustRepository } from './ports';

/**
 * Emails to a notifier without an account who left an address: the receipt of the notice,
 * then the outcome (a member is told by the notifications module instead).
 */
@Injectable()
export class NoticesService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly mailer: Mailer,
  ) {}

  async send(reportId: string, kind: 'received' | 'resolved'): Promise<boolean> {
    const report = await this.trust.findReport(reportId);
    if (!report || report.reporterId || !report.reporterEmail) return false;
    if (kind === 'resolved' && !report.outcome) return false;
    const notice =
      kind === 'received'
        ? 'report_received'
        : report.outcome === 'action_taken'
          ? 'report_action_taken'
          : 'report_no_action';
    const { subject, html, text } = await renderPlatformNoticeEmail({
      locale: report.reporterLocale ?? 'fr',
      kind: notice,
      name: report.reporterName,
      reference: report.id,
    });
    await this.mailer.send({ to: report.reporterEmail, subject, html, text });
    return true;
  }
}
