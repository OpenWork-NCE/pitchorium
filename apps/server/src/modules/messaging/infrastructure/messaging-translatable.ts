import { Injectable, type OnModuleInit } from '@nestjs/common';
import { LocalizationFacade } from '../../localization';
import { ConversationAccess } from '../application/conversation-access';
import { MessagingRepository } from '../application/ports';

/**
 * A message offered to the translation on demand (§8.3) only on the explicit action of a
 * participant who sees the conversation; its translation is never cached.
 */
@Injectable()
export class MessagingTranslatable implements OnModuleInit {
  constructor(
    private readonly localization: LocalizationFacade,
    private readonly messaging: MessagingRepository,
    private readonly access: ConversationAccess,
  ) {}

  onModuleInit(): void {
    this.localization.registerTranslatableSource({
      type: 'message',
      read: async (id, readerId) => {
        const message = await this.messaging.findMessage(id);
        if (!message || message.deletedAt || message.moderationStatus !== 'visible') return null;
        if (!(await this.access.find(readerId, message.conversationId))) return null;
        const fields: Record<string, string> = {};
        if (message.body.trim()) fields['text'] = message.body;
        return { key: message.id, fields, language: null };
      },
    });
  }
}
