import type { Locale } from '@pitchorium/contracts';
import { translate, type TranslationParams } from '@pitchorium/i18n';
import { ActionLink, Note, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

export type SignInMethodChange = 'linked' | 'unlinked' | 'password_changed' | 'password_reset';

export interface SignInMethodChangedEmailProps {
  locale: Locale;
  name: string;
  change: SignInMethodChange;
  /** Provider id (google, linkedin, microsoft, credential); ignored for password changes. */
  provider: string;
  /** ISO 8601, rendered as UTC. */
  changedAt: string;
  securityUrl: string;
}

const t = (locale: Locale, key: string, params: TranslationParams = {}) =>
  translate(locale, 'emails', `signInMethodChanged.${key}`, params);

export function signInMethodChangedSubject(locale: Locale): string {
  return t(locale, 'subject');
}

export default function SignInMethodChangedEmail(props: SignInMethodChangedEmailProps) {
  const { locale, name, change, provider, changedAt, securityUrl } = props;
  const method = translate(locale, 'emails', `providers.${provider}`);
  return (
    <Layout locale={locale} preview={t(locale, 'preview')}>
      <Title>{t(locale, 'heading', { name })}</Title>
      <Paragraph>{t(locale, `changes.${change}`, { method, changedAt })}</Paragraph>
      <Paragraph>{t(locale, 'notYou')}</Paragraph>
      <ActionLink href={securityUrl} label={t(locale, 'action')} />
      <Note>{t(locale, 'reason')}</Note>
    </Layout>
  );
}

SignInMethodChangedEmail.PreviewProps = {
  locale: 'fr',
  name: 'Amina',
  change: 'linked',
  provider: 'google',
  changedAt: '2026-01-01T09:30:00.000Z',
  securityUrl: 'https://app.pitchorium.example/settings/security',
} satisfies SignInMethodChangedEmailProps;
