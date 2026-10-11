/**
 * Public facade of the messaging feature (§10.4): the page of the messages (list, conversation,
 * first message), the introductions, the settings « Messagerie », and the entries other pages
 * compose (« Message », « Contacter », « Présenter à… », « Envoyer en message »).
 */
export { ConversationList } from './components/conversation-list';
export { ConversationThread } from './components/conversation-thread';
export { ConversationView } from './components/conversation-view';
export { IntroduceButton, MessageButton } from './components/entry-points';
/** « Envoyer en message »: the dialog, loaded by the member shell at its first opening. */
export { default as ShareDialog } from './components/share-dialog';
export { IntroductionCard } from './components/introduction-card';
export { IntroductionsBox } from './components/introductions-box';
export { MessageComposer } from './components/message-composer';
export { MessagesFrame, NoConversation } from './components/messages-frame';
export { MessagingSettings } from './components/messaging-settings';
export { NewConversation } from './components/new-conversation';
export { THREAD_PAGE_SIZE } from './lib/limits';
