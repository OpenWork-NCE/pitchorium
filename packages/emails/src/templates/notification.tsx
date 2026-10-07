import type { Locale, NotificationType } from '@pitchorium/contracts';
import { translate } from '@pitchorium/i18n';
import { ActionLink, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

/** Values of the notification texts (`notifications.types.<type>`). */
export interface NotificationTextParams {
  actor?: string;
  others?: number;
  count?: number;
  title?: string;
  position?: number;
}

export interface NotificationEmailProps {
  locale: Locale;
  name: string;
  type: NotificationType;
  /** Several actors or events: the grouped text. */
  grouped: boolean;
  params: NotificationTextParams;
  actionUrl: string;
  /** Null for a transactional notification, which cannot be turned off. */
  unsubscribeUrl: string | null;
}

/** Text of a notification in a locale, shared by the email and its subject. */
export function notificationText(
  locale: Locale,
  type: NotificationType,
  grouped: boolean,
  params: NotificationTextParams,
): string {
  return translate(locale, 'notifications', `types.${type}.${grouped ? 'many' : 'one'}`, {
    actor: params.actor ?? '',
    others: String(params.others ?? 0),
    count: String(params.count ?? 1),
    title: params.title ?? '',
    position: String(params.position ?? ''),
  });
}

export function notificationSubject(props: NotificationEmailProps): string {
  return notificationText(props.locale, props.type, props.grouped, props.params);
}

/** One notification sent at once (§10.5). */
export default function NotificationEmail(props: NotificationEmailProps) {
  const { locale, name, actionUrl, unsubscribeUrl } = props;
  const text = notificationSubject(props);
  return (
    <Layout locale={locale} preview={text} unsubscribeUrl={unsubscribeUrl}>
      <Title>{translate(locale, 'emails', 'notification.greeting', { name })}</Title>
      <Paragraph>{text}</Paragraph>
      <ActionLink href={actionUrl} label={translate(locale, 'emails', 'notification.action')} />
    </Layout>
  );
}

NotificationEmail.PreviewProps = {
  locale: 'fr',
  name: 'Kofi Mensah',
  type: 'reaction',
  grouped: true,
  params: { actor: 'Amina Diop', others: 12 },
  actionUrl: 'https://app.pitchorium.example/posts/abc',
  unsubscribeUrl: 'https://app.pitchorium.example/notifications/unsubscribe?token=abc',
} satisfies NotificationEmailProps;
