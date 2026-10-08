import type { Locale } from '@pitchorium/contracts';
import { translate, type TranslationParams } from '@pitchorium/i18n';
import { ActionLink, Note, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

export type OrganizationNoticeKind =
  | 'invitation'
  | 'role_changed'
  | 'ownership_transferred'
  | 'verification_requested'
  | 'verification_approved'
  | 'verification_rejected'
  | 'verification_revoked';

export type OrganizationRoleLabel = 'owner' | 'admin' | 'member';

export interface OrganizationNoticeEmailProps {
  locale: Locale;
  kind: OrganizationNoticeKind;
  /** Recipient; null for an invitation to an address without an account. */
  name: string | null;
  organization: string;
  actionUrl: string;
  /** Role granted (invitation, role change). */
  role?: OrganizationRoleLabel;
  /** Other member concerned: inviter or new owner. */
  member?: string;
  /** Motivation of a verification decision or revocation. */
  reason?: string;
  /** Invitation expiry, rendered as UTC. */
  expiresAt?: string;
}

const t = (locale: Locale, key: string, params: TranslationParams = {}) =>
  translate(locale, 'emails', `organizationNotice.${key}`, params);

function params(props: OrganizationNoticeEmailProps): TranslationParams {
  return {
    organization: props.organization,
    member: props.member ?? '',
    role: props.role ? t(props.locale, `roles.${props.role}`) : '',
    expiresAt: props.expiresAt ?? '',
  };
}

export function organizationNoticeSubject(props: OrganizationNoticeEmailProps): string {
  return t(props.locale, `${props.kind}.subject`, params(props));
}

/** Organization emails: invitation, membership changes and verification steps. */
export default function OrganizationNoticeEmail(props: OrganizationNoticeEmailProps) {
  const { locale, kind, name, actionUrl, reason } = props;
  const values = params(props);
  const hasNote = kind === 'invitation' || kind === 'verification_rejected';
  return (
    <Layout locale={locale} preview={t(locale, `${kind}.preview`, values)}>
      <Title>{name ? t(locale, 'greeting', { name }) : t(locale, 'greetingAnonymous')}</Title>
      <Paragraph>{t(locale, `${kind}.body`, values)}</Paragraph>
      {reason ? <Paragraph>{t(locale, 'reason', { reason })}</Paragraph> : null}
      <ActionLink href={actionUrl} label={t(locale, `${kind}.action`, values)} />
      {hasNote ? <Note>{t(locale, `${kind}.note`, values)}</Note> : null}
    </Layout>
  );
}

OrganizationNoticeEmail.PreviewProps = {
  locale: 'fr',
  kind: 'invitation',
  name: null,
  organization: 'Fondation Teranga',
  actionUrl: 'https://app.pitchorium.example/invitations/abc',
  role: 'member',
  member: 'Amina Diop',
  expiresAt: '2026-10-14 09:30',
} satisfies OrganizationNoticeEmailProps;
