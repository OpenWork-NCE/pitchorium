import { FileClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Container } from '@/components/layout/container';
import { Callout, Heading, Kicker, Text } from '@/components/ui';
import type { MarkdownDocument } from '../lib/markdown';
import { type LegalVersions, versionShown } from '../lib/legal-documents';
import { MarkdownBlocks } from './markdown-blocks';

/**
 * A legal page of the public site (ADR 0157): its versioned Markdown, the version in force read
 * from the api for the terms and the privacy policy, and while its text is not provided, the
 * visible block awaiting legal validation. No legal text is ever written here.
 */
export function LegalPage({
  document,
  versions,
}: {
  document: MarkdownDocument;
  versions: LegalVersions | null;
}) {
  const t = useTranslations('web.marketing.legal');
  const version = versionShown(document.meta.version, versions);
  const pending = document.meta.status !== 'validated';
  return (
    <Container className="py-12 md:py-20">
      <article className="mx-auto max-w-prose">
        <Kicker>{t('kicker')}</Kicker>
        <Heading level={1} size="display" className="title-reveal mt-4">
          {document.meta.title}
        </Heading>
        {version ? (
          <Text tone="muted" className="mt-4" data-legal-version={version}>
            {t('version', { version })}
          </Text>
        ) : null}
        {pending ? (
          <Callout className="mt-8" icon={<FileClock />} title={t('pendingTitle')}>
            <span data-legal-pending="">{t('pendingBody')}</span>
          </Callout>
        ) : null}
        <div className="text-base/7">
          <MarkdownBlocks blocks={document.blocks} />
        </div>
      </article>
    </Container>
  );
}
