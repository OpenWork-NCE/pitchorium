import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Locale } from '@pitchorium/contracts';
import type { LegalDocument } from './legal-documents';
import { type MarkdownDocument, parseMarkdown } from './markdown';

/** Folder of the versioned legal texts, traced into the build of the page (next.config.ts). */
const LEGAL_ROOT = join(process.cwd(), 'content', 'legal');

/** The Markdown of a legal page in a locale, in French when that locale has none. */
export async function loadLegalDocument(
  document: LegalDocument,
  locale: Locale,
): Promise<MarkdownDocument> {
  const read = (lang: string) => readFile(join(LEGAL_ROOT, lang, `${document}.md`), 'utf8');
  const source = await read(locale).catch(() => read('fr'));
  return parseMarkdown(source);
}
