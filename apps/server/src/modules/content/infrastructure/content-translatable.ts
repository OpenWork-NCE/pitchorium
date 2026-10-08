import { Injectable, type OnModuleInit } from '@nestjs/common';
import { LocalizationFacade } from '../../localization';
import { ContentRepository } from '../application/ports';
import { PostPresenter } from '../application/post-presenter';

const filled = (fields: Record<string, string | null>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())),
  );

/**
 * Publications and comments offered to the translation on demand (§8.3), as the reader sees
 * them: a hidden, removed or deleted one, or one of a publication they may not see, is absent.
 */
@Injectable()
export class ContentTranslatable implements OnModuleInit {
  constructor(
    private readonly localization: LocalizationFacade,
    private readonly content: ContentRepository,
    private readonly presenter: PostPresenter,
  ) {}

  onModuleInit(): void {
    this.localization.registerTranslatableSource({
      type: 'post',
      read: async (id, readerId) => {
        const post = await this.content.findPost(id);
        if (!post || post.deletedAt || post.moderationStatus !== 'visible') return null;
        if (!(await this.presenter.canRead(await this.presenter.reader(readerId), post)))
          return null;
        return { key: post.id, fields: filled({ text: post.text }), language: post.language };
      },
    });
    this.localization.registerTranslatableSource({
      type: 'comment',
      read: async (id, readerId) => {
        const comment = await this.content.findComment(id);
        if (!comment || comment.deletedAt || comment.moderationStatus !== 'visible') return null;
        const post = await this.content.findPost(comment.postId);
        if (!post || post.deletedAt) return null;
        if (!(await this.presenter.canRead(await this.presenter.reader(readerId), post)))
          return null;
        return { key: comment.id, fields: filled({ text: comment.text }), language: null };
      },
    });
  }
}
