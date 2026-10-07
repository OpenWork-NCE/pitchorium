import type { Locale } from '@pitchorium/contracts';
import { translate, type TranslationParams } from '@pitchorium/i18n';
import { ActionLink, Note, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

export interface PasswordResetEmailProps {
  locale: Locale;
  name: string;
  url: string;
  expiresInMinutes: number;
}

const t = (locale: Locale, key: string, params: TranslationParams = {}) =>
  translate(locale, 'emails', `passwordReset.${key}`, params);

export function passwordResetSubject(locale: Locale): string {
  return t(locale, 'subject');
}

export default function PasswordResetEmail(props: PasswordResetEmailProps) {
  const { locale, name, url, expiresInMinutes } = props;
  return (
    <Layout locale={locale} preview={t(locale, 'preview')}>
      <Title>{t(locale, 'heading', { name })}</Title>
      <Paragraph>{t(locale, 'body')}</Paragraph>
      <ActionLink href={url} label={t(locale, 'action')} />
      <Note>{t(locale, 'expiry', { minutes: expiresInMinutes })}</Note>
      <Note>{t(locale, 'ignore')}</Note>
    </Layout>
  );
}

PasswordResetEmail.PreviewProps = {
  locale: 'fr',
  name: 'Amina',
  url: 'https://app.pitchorium.example/reset?token=preview',
  expiresInMinutes: 30,
} satisfies PasswordResetEmailProps;
