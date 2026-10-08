import type { Locale } from '@pitchorium/contracts';
import { translate, type TranslationParams } from '@pitchorium/i18n';
import { ActionLink, Note, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

/**
 * Notices sent to an address rather than to a member: the notifier of illegal content without
 * an account (receipt, then the outcome), the former member whose account was erased.
 */
export type PlatformNoticeKind =
  'report_received' | 'report_action_taken' | 'report_no_action' | 'account_erased';

export interface PlatformNoticeEmailProps {
  locale: Locale;
  kind: PlatformNoticeKind;
  name: string | null;
  /** Reference of the report, or date of the erasure (UTC). */
  reference: string;
  actionUrl?: string;
}

const t = (locale: Locale, key: string, params: TranslationParams = {}) =>
  translate(locale, 'emails', `platformNotice.${key}`, params);

export function platformNoticeSubject(props: PlatformNoticeEmailProps): string {
  return t(props.locale, `${props.kind}.subject`, { reference: props.reference });
}

export default function PlatformNoticeEmail(props: PlatformNoticeEmailProps) {
  const { locale, kind, name, reference, actionUrl } = props;
  const values = { reference };
  return (
    <Layout locale={locale} preview={t(locale, `${kind}.preview`, values)}>
      <Title>{name ? t(locale, 'greeting', { name }) : t(locale, 'greetingAnonymous')}</Title>
      <Paragraph>{t(locale, `${kind}.body`, values)}</Paragraph>
      {actionUrl ? <ActionLink href={actionUrl} label={t(locale, `${kind}.action`)} /> : null}
      <Note>{t(locale, `${kind}.note`, values)}</Note>
    </Layout>
  );
}

PlatformNoticeEmail.PreviewProps = {
  locale: 'fr',
  kind: 'report_received',
  name: null,
  reference: '01999999-0000-7000-8000-000000000000',
} satisfies PlatformNoticeEmailProps;
