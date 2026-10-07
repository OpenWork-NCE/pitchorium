import type { Locale } from '@pitchorium/contracts';
import { translate } from '@pitchorium/i18n';
import { ActionLink, Note, Paragraph, Title } from '../components/blocks.js';
import { Layout } from '../components/layout.js';

export interface UnreadMessagesEmailProps {
  locale: Locale;
  name: string;
  /** Sender of the most recent unread message. */
  sender: string;
  count: number;
  /** Excerpts of the unread messages, oldest first. */
  excerpts: { sender: string; text: string; attachments: number }[];
  conversationUrl: string;
  unsubscribeUrl: string;
}

const t = (locale: Locale, key: string, params: Record<string, string> = {}) =>
  translate(locale, 'emails', `unreadMessages.${key}`, params);

export function unreadMessagesSubject(props: UnreadMessagesEmailProps): string {
  return t(props.locale, props.count > 1 ? 'subject.many' : 'subject.one', {
    sender: props.sender,
    count: String(props.count),
  });
}

/** Copy of unread messages of one conversation (§10.4), sent when the member accepted it. */
export default function UnreadMessagesEmail(props: UnreadMessagesEmailProps) {
  const { locale, name, excerpts } = props;
  return (
    <Layout
      locale={locale}
      preview={unreadMessagesSubject(props)}
      unsubscribeUrl={props.unsubscribeUrl}
    >
      <Title>{translate(locale, 'emails', 'notification.greeting', { name })}</Title>
      {excerpts.map((excerpt, index) => (
        <Paragraph key={index}>
          {`${excerpt.sender} : ${excerpt.text || t(locale, 'attachments', { count: String(excerpt.attachments) })}`}
        </Paragraph>
      ))}
      <ActionLink href={props.conversationUrl} label={t(locale, 'action')} />
      <Note>{t(locale, 'note')}</Note>
    </Layout>
  );
}

UnreadMessagesEmail.PreviewProps = {
  locale: 'fr',
  name: 'Kofi Mensah',
  sender: 'Amina Diop',
  count: 2,
  excerpts: [
    { sender: 'Amina Diop', text: 'Bonjour Kofi, avez-vous vu notre dossier ?', attachments: 0 },
    { sender: 'Amina Diop', text: '', attachments: 1 },
  ],
  conversationUrl: 'https://app.pitchorium.example/messages/abc',
  unsubscribeUrl: 'https://app.pitchorium.example/notifications/unsubscribe?token=abc',
} satisfies UnreadMessagesEmailProps;
