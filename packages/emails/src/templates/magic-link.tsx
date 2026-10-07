import type { Locale } from '@pitchorium/contracts';
import { translate, type TranslationParams } from '@pitchorium/i18n';
import { ActionLink, Note, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

export interface MagicLinkEmailProps {
  locale: Locale;
  url: string;
  expiresInMinutes: number;
}

const t = (locale: Locale, key: string, params: TranslationParams = {}) =>
  translate(locale, 'emails', `magicLink.${key}`, params);

export function magicLinkSubject(locale: Locale): string {
  return t(locale, 'subject');
}

export default function MagicLinkEmail({ locale, url, expiresInMinutes }: MagicLinkEmailProps) {
  return (
    <Layout locale={locale} preview={t(locale, 'preview')}>
      <Title>{t(locale, 'heading')}</Title>
      <Paragraph>{t(locale, 'body')}</Paragraph>
      <ActionLink href={url} label={t(locale, 'action')} />
      <Note>{t(locale, 'expiry', { minutes: expiresInMinutes })}</Note>
      <Note>{t(locale, 'ignore')}</Note>
    </Layout>
  );
}

MagicLinkEmail.PreviewProps = {
  locale: 'fr',
  url: 'https://app.pitchorium.example/magic?token=preview',
  expiresInMinutes: 15,
} satisfies MagicLinkEmailProps;
