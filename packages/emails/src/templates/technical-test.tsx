import type { Locale } from '@pitchorium/contracts';
import { translate } from '@pitchorium/i18n';
import { Heading, Text } from 'react-email';
import { Layout } from '../components/layout.js';

export interface TechnicalTestEmailProps {
  locale: Locale;
  sentAt: string;
}

export function technicalTestSubject(locale: Locale): string {
  return translate(locale, 'emails', 'technicalTest.subject');
}

export default function TechnicalTestEmail({ locale, sentAt }: TechnicalTestEmailProps) {
  const t = (key: string) => translate(locale, 'emails', `technicalTest.${key}`, { sentAt });
  return (
    <Layout locale={locale} preview={t('preview')}>
      <Heading as="h1" style={{ fontSize: 22, margin: '0 0 16px' }}>
        {t('heading')}
      </Heading>
      <Text style={{ fontSize: 15, lineHeight: '24px', margin: 0 }}>{t('body')}</Text>
    </Layout>
  );
}

TechnicalTestEmail.PreviewProps = {
  locale: 'fr',
  sentAt: '2026-01-01T00:00:00.000Z',
} satisfies TechnicalTestEmailProps;
