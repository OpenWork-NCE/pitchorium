import type { Locale } from '@pitchorium/contracts';
import { translate } from '@pitchorium/i18n';
import type { ReactNode } from 'react';
import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from 'react-email';
import { theme } from '../theme.js';

export interface LayoutProps {
  locale: Locale;
  preview: string;
  children: ReactNode;
  /** One-click unsubscribe page of a non-transactional email (RFC 8058, ADR 0062). */
  unsubscribeUrl?: string | null;
}

export function Layout({ locale, preview, children, unsubscribeUrl }: LayoutProps) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: theme.background, fontFamily: theme.fontFamily, margin: 0 }}>
        <Container
          style={{
            backgroundColor: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            margin: '32px auto',
            maxWidth: 560,
            padding: 32,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: 600, margin: 0 }}>
            {translate(locale, 'common', 'appName')}
          </Text>
          <Section style={{ color: theme.text, marginTop: 24 }}>{children}</Section>
          <Hr style={{ borderColor: theme.border, margin: '32px 0 16px' }} />
          <Text style={{ color: theme.muted, fontSize: 12, margin: 0 }}>
            {translate(locale, 'emails', 'layout.footer')}
          </Text>
          {unsubscribeUrl ? (
            <Text style={{ color: theme.muted, fontSize: 12, margin: '8px 0 0' }}>
              <Link href={unsubscribeUrl} style={{ color: theme.muted }}>
                {translate(locale, 'emails', 'layout.unsubscribe')}
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
