import type { Locale } from '@pitchorium/contracts';
import { translate, type TranslationParams } from '@pitchorium/i18n';
import { ActionLink, Note, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

export interface EmailVerificationEmailProps {
  locale: Locale;
  name: string;
  url: string;
  expiresInHours: number;
}

const t = (locale: Locale, key: string, params: TranslationParams = {}) =>
  translate(locale, 'emails', `emailVerification.${key}`, params);

export function emailVerificationSubject(locale: Locale): string {
  return t(locale, 'subject');
}

export default function EmailVerificationEmail(props: EmailVerificationEmailProps) {
  const { locale, name, url, expiresInHours } = props;
  return (
    <Layout locale={locale} preview={t(locale, 'preview')}>
      <Title>{t(locale, 'heading', { name })}</Title>
      <Paragraph>{t(locale, 'body')}</Paragraph>
      <ActionLink href={url} label={t(locale, 'action')} />
      <Note>{t(locale, 'expiry', { hours: expiresInHours })}</Note>
      <Note>{t(locale, 'ignore')}</Note>
    </Layout>
  );
}

EmailVerificationEmail.PreviewProps = {
  locale: 'fr',
  name: 'Amina',
  url: 'https://app.pitchorium.example/verify?token=preview',
  expiresInHours: 24,
} satisfies EmailVerificationEmailProps;
