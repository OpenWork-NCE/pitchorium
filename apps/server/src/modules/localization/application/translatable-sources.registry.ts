import { Injectable } from '@nestjs/common';
import type { TranslationSourceType } from '@pitchorium/contracts';

export interface TranslatableContent {
  /** Stable key of the content in the cache (its id; the member id for a profile). */
  key: string;
  /** Texts to translate, by field name; empty fields are left out. */
  fields: Record<string, string>;
  /** Known language of the original, null when unknown. */
  language: string | null;
}

/**
 * A module owning translatable contents registers how to read one for a reader: only what
 * the reader may see (visibility, blocks, participation in a conversation), null otherwise.
 */
export interface TranslatableSource {
  type: TranslationSourceType;
  read(id: string, readerId: string): Promise<TranslatableContent | null>;
}

@Injectable()
export class TranslatableSourcesRegistry {
  private readonly sources = new Map<TranslationSourceType, TranslatableSource>();

  register(source: TranslatableSource): void {
    if (this.sources.has(source.type)) throw new Error(`Source ${source.type} already registered`);
    this.sources.set(source.type, source);
  }

  get(type: TranslationSourceType): TranslatableSource | null {
    return this.sources.get(type) ?? null;
  }
}
