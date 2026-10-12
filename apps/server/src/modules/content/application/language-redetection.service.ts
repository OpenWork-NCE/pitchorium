import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../../../platform/database';
import { PostUpdated } from '../domain/content-events';
import { resolveLanguage } from '../domain/language';
import { ContentEventsRecorder } from './content-events.recorder';
import { ContentRepository, LanguageDetector } from './ports';

/** Publications read at once. */
const BATCH = 200;

/**
 * Detects again the language of every publication whose author did not declare it
 * (`pnpm content:redetect-languages`), after a change of the detection (ADR 0169). The other
 * contents of the members (comments, messages, profiles, projects, missions) are detected when
 * read, so they follow at once.
 */
@Injectable()
export class LanguageRedetectionService {
  constructor(
    private readonly content: ContentRepository,
    private readonly language: LanguageDetector,
    private readonly events: ContentEventsRecorder,
    private readonly transactions: TransactionManager,
  ) {}

  /**
   * A changed language is written without marking the publication edited, and announced to the
   * modules that index it (`content.post.updated.v1`). Idempotent: a second run changes nothing.
   */
  async run(): Promise<{ checked: number; changed: number }> {
    let checked = 0;
    let changed = 0;
    let after: string | null = null;
    for (;;) {
      const batch = await this.content.postsWithUndeclaredLanguage(after, BATCH);
      if (batch.length === 0) break;
      for (const post of batch) {
        checked += 1;
        const next = resolveLanguage(null, this.language.detect(post.text));
        if (next.language === post.language) continue;
        await this.transactions.run(async () => {
          await this.content.updatePost(post.id, next);
          await this.events.record(PostUpdated, post.id, {
            authorId: post.authorId,
            fields: ['language'],
          });
        });
        changed += 1;
      }
      after = batch.at(-1)!.id;
    }
    return { checked, changed };
  }
}
