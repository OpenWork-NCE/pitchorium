import type { Locale } from '@pitchorium/contracts';
import { translate, type TranslationParams } from '@pitchorium/i18n';
import { ActionLink, Note, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

export interface NewSignInEmailProps {
  locale: Locale;
  name: string;
  /** ISO 8601, rendered as UTC. */
  signedInAt: string;
  device: string;
  securityUrl: string;
}

const t = (locale: Locale, key: string, params: TranslationParams = {}) =>
  translate(locale, 'emails', `newSignIn.${key}`, params);

export function newSignInSubject(locale: Locale): string {
  return t(locale, 'subject');
}

export default function NewSignInEmail(props: NewSignInEmailProps) {
  const { locale, name, signedInAt, device, securityUrl } = props;
  return (
    <Layout locale={locale} preview={t(locale, 'preview')}>
      <Title>{t(locale, 'heading', { name })}</Title>
      <Paragraph>{t(locale, 'body', { signedInAt, device })}</Paragraph>
      <Paragraph>{t(locale, 'notYou')}</Paragraph>
      <ActionLink href={securityUrl} label={t(locale, 'action')} />
      <Note>{t(locale, 'reason')}</Note>
    </Layout>
  );
}

NewSignInEmail.PreviewProps = {
  locale: 'fr',
  name: 'Amina',
  signedInAt: '2026-01-01T09:30:00.000Z',
  device: 'Firefox on Linux',
  securityUrl: 'https://app.pitchorium.example/settings/security',
} satisfies NewSignInEmailProps;
