// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { LEGAL_DOCUMENTS, versionShown } from '../lib/legal-documents';
import { parseMarkdown } from '../lib/markdown';
import { LegalPage } from './legal-page';

const read = (locale: string, document: string) =>
  parseMarkdown(
    readFileSync(join(process.cwd(), 'content', 'legal', locale, `${document}.md`), 'utf8'),
  );
const VERSIONS = { termsVersion: 'draft-2026-10', privacyVersion: 'privacy-2026-10' };

describe('legal pages (ADR 0157)', () => {
  it('has every document in French and in English, with a title, a status and a version', () => {
    for (const locale of ['fr', 'en']) {
      for (const document of LEGAL_DOCUMENTS) {
        const { meta, blocks } = read(locale, document);
        expect(meta.title, `${locale}/${document}`).toBeTruthy();
        expect(['pending', 'validated']).toContain(meta.status);
        expect(['terms', 'privacy', 'none']).toContain(meta.version);
        expect(blocks.some((block) => block.type === 'heading')).toBe(true);
      }
    }
  });

  it('renders a pending document from its Markdown with the block awaiting validation', () => {
    renderWithProviders(<LegalPage document={read('fr', 'terms')} versions={VERSIONS} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Conditions générales d’utilisation',
    );
    expect(screen.getByText('Texte en attente de validation juridique')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Droit applicable et litiges' }),
    ).toBeTruthy();
  });

  it('shows the legal version of the api the document carries, and none for the others', () => {
    renderWithProviders(<LegalPage document={read('en', 'privacy')} versions={VERSIONS} />, {
      locale: 'en',
    });
    expect(screen.getByText('Version in force: privacy-2026-10')).toBeTruthy();
    expect(versionShown('terms', VERSIONS)).toBe('draft-2026-10');
    expect(versionShown('none', VERSIONS)).toBeNull();
    expect(versionShown('terms', null)).toBeNull();
  });

  it('hides the block once the text is validated', () => {
    const validated = parseMarkdown(
      '---\ntitle: T\nstatus: validated\nversion: none\n---\n\n## A\n\nB',
    );
    renderWithProviders(<LegalPage document={validated} versions={null} />);
    expect(screen.queryByText('Texte en attente de validation juridique')).toBeNull();
  });
});
