'use client';

import { mediaControllerDownload, useInterestsControllerList } from '@pitchorium/api-client';
import type { ProjectInterest, ProjectInterestKind } from '@pitchorium/contracts';
import { FileText } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DeferredSelect,
  EmptyState,
  Field,
  Loading,
  Skeleton,
} from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import { useProjectEditor } from '../editor/editor-context';
import { useProblemText } from '../shared/use-problem-text';

const KINDS: readonly ProjectInterestKind[] = ['grant', 'honor_loan', 'equity', 'general'];
const ALL = 'all';

/**
 * The expressions of interest received (§9.1, §11.3), for the team only: by type, each with its
 * author, its message, its indicative amount (binding no one) and its private files, opened by an
 * address signed at the click.
 */
export function InterestsPanel() {
  const t = useTranslations('web.projects.manage.interests');
  const kinds = useTranslations('reference.projectInterestKinds');
  const { project } = useProjectEditor();
  const list = useInterestsControllerList(
    project.id,
    { limit: 100 },
    { query: { staleTime: 30_000 } },
  );
  const [kind, setKind] = useState<ProjectInterestKind | typeof ALL>(ALL);
  const items = (list.data?.items ?? []).filter((item) => kind === ALL || item.kind === kind);
  return (
    <div className="grid gap-6">
      <Field label={t('filter')} className="max-w-xs">
        <DeferredSelect
          value={kind}
          onValueChange={setKind}
          options={[
            { value: ALL, label: t('all') },
            ...KINDS.map((value) => ({ value, label: kinds(value) })),
          ]}
        />
      </Field>
      {list.isPending ? (
        <Loading className="grid gap-3">
          <Skeleton className="h-32" />
        </Loading>
      ) : items.length === 0 ? (
        <EmptyState size="inline" title={t('empty')} description={t('emptyBody')} />
      ) : (
        <ul className="grid gap-4">
          {items.map((interest) => (
            <InterestItem key={interest.id} interest={interest} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A private file, opened in a new tab by an address the api signs for a short while at the click
 * (the tab opens at the click, a later one would be blocked).
 */
async function openSigned(mediaId: string): Promise<void> {
  const opened = window.open('', '_blank', 'noopener');
  try {
    const { url } = await mediaControllerDownload(mediaId);
    if (opened) opened.location.href = url;
    else window.location.href = url;
  } catch (error) {
    opened?.close();
    throw error;
  }
}

function InterestItem({ interest }: { interest: ProjectInterest }) {
  const t = useTranslations('web.projects.manage.interests');
  const kinds = useTranslations('reference.projectInterestKinds');
  const format = useFormatter();
  const locale = useLocale();
  const problemText = useProblemText();
  const [problem, setProblem] = useState<string | null>(null);
  const open = (mediaId: string) => {
    setProblem(null);
    void openSigned(mediaId).catch((error: unknown) => setProblem(problemText(error)));
  };
  return (
    <li data-interest={interest.kind}>
      <Card padding="sm" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar
            name={interest.member.displayName}
            src={interest.member.avatarUrl}
            size="md"
            decorative
          />
          <div className="grid min-w-0 flex-1 text-sm">
            <span className="font-medium">{interest.member.displayName}</span>
            <span className="text-muted">
              {format.dateTime(new Date(interest.createdAt), { dateStyle: 'long' })}
            </span>
          </div>
          <Badge tone="accent">{kinds(interest.kind)}</Badge>
        </div>
        <p className="break-words whitespace-pre-line">{interest.message}</p>
        {interest.indicativeAmount ? (
          <p className="text-sm">
            {t('amount', { amount: formatMoney(interest.indicativeAmount, locale) })}
          </p>
        ) : null}
        {interest.documents.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {interest.documents.map((document, index) => (
              <li key={document.mediaId}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => open(document.mediaId)}
                >
                  <FileText aria-hidden />
                  {t('document', { index: index + 1 })}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </Card>
    </li>
  );
}
