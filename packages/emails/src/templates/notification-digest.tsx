import type { Locale } from '@pitchorium/contracts';
import { translate } from '@pitchorium/i18n';
import { Link, Text } from 'react-email';
import { ActionLink, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';
import { theme } from '../theme.js';

export interface NotificationDigestEmailProps {
  locale: Locale;
  name: string;
  period: 'daily' | 'weekly';
  /** Texts already rendered in the locale, most recent first. */
  items: { text: string; url: string }[];
  notificationsUrl: string;
  unsubscribeUrl: string;
}

const t = (locale: Locale, key: string, params: Record<string, string> = {}) =>
  translate(locale, 'emails', `notificationDigest.${key}`, params);

export function notificationDigestSubject(props: NotificationDigestEmailProps): string {
  return t(props.locale, `subject.${props.period}`, { count: String(props.items.length) });
}

/** Daily (§10.5, optional) or weekly (§14, V2) summary of the notifications. */
export default function NotificationDigestEmail(props: NotificationDigestEmailProps) {
  const { locale, name, items } = props;
  return (
    <Layout
      locale={locale}
      preview={notificationDigestSubject(props)}
      unsubscribeUrl={props.unsubscribeUrl}
    >
      <Title>{translate(locale, 'emails', 'notification.greeting', { name })}</Title>
      <Paragraph>{t(locale, `intro.${props.period}`)}</Paragraph>
      {items.map((item) => (
        <Text
          key={item.url + item.text}
          style={{ fontSize: 15, lineHeight: '22px', margin: '0 0 8px' }}
        >
          <Link href={item.url} style={{ color: theme.text }}>
            {item.text}
          </Link>
        </Text>
      ))}
      <ActionLink href={props.notificationsUrl} label={t(locale, 'action')} />
    </Layout>
  );
}

NotificationDigestEmail.PreviewProps = {
  locale: 'fr',
  name: 'Kofi Mensah',
  period: 'daily',
  items: [
    {
      text: 'Amina Diop et 12 autres ont réagi à votre publication',
      url: 'https://app.pitchorium.example/posts/abc',
    },
    {
      text: 'Nouvelle actualité de Lagos Recycle',
      url: 'https://app.pitchorium.example/projects/lagos-recycle',
    },
  ],
  notificationsUrl: 'https://app.pitchorium.example/notifications',
  unsubscribeUrl: 'https://app.pitchorium.example/notifications/unsubscribe?token=abc',
} satisfies NotificationDigestEmailProps;
