'use client';

import {
  moderationControllerAppeals,
  moderationControllerResolveAppeal,
} from '@pitchorium/api-client';
import type { AppealOutcome, CursorPage, ModerationAppealItem } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Field,
  RadioGroup,
  Text,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { useConsoleAction, useConsoleProblem } from '@/features/admin';
import { Link, useRouter } from '@/i18n/navigation';
import { DecisionStatement } from '../decision-statement';
import { STATEMENT_MAX, STATEMENT_MIN } from './decision-form';

/**
 * The pending appeals, oldest first (§13, ADR 0072): each with its decision, the arguments of
 * the member and who decided. The internal complaint goes to another person than the author of
 * the decision: the api says so (`resolvable`, TRUST_SAME_MODERATOR), and the console shows
 * why instead of the action.
 */
export function AppealsQueue({ page }: { page: CursorPage<ModerationAppealItem> }) {
  const t = useTranslations('web.admin.moderation.appeals');
  const problem = useConsoleProblem();
  const [items, setItems] = useState(page.items);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function more() {
    if (!cursor) return;
    setLoading(true);
    try {
      const next = await moderationControllerAppeals({ cursor, limit: 20 });
      setItems((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setLoading(false);
    }
  }
  if (items.length === 0) {
    return <EmptyState title={t('empty')} description={t('emptyHint')} />;
  }
  return (
    <div className="grid gap-4">
      <ul className="grid gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <AppealCard item={item} />
          </li>
        ))}
      </ul>
      {cursor ? (
        <Button
          variant="secondary"
          className="justify-self-center"
          loading={loading}
          onClick={() => void more()}
        >
          {t('more')}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AppealCard({ item }: { item: ModerationAppealItem }) {
  const t = useTranslations('web.admin.moderation.appeals');
  const errors = useTranslations('errors');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const resolve = useConsoleAction('trust.appeal.resolve');
  const names = new Map(item.people.map((person) => [person.userId, person.name]));
  const nameOf = (id: string | null) =>
    id ? (names.get(id) ?? common('deletedMember')) : common('deletedMember');
  const appeal = item.appeal;
  return (
    <Card className="grid gap-4 p-5" aria-labelledby={`appeal-${item.id}`}>
      <DecisionStatement
        decision={item}
        date={(iso) => format.dateTime(new Date(iso), { dateStyle: 'long' })}
        titleId={`appeal-${item.id}`}
        headingLevel={2}
        badge={<Badge tone="warning">{t('pending')}</Badge>}
      />
      <Text size="sm" tone="muted">
        {t('concerned', { name: nameOf(item.subjectId) })} ·{' '}
        {t('decidedBy', { name: nameOf(item.decidedBy) })}
      </Text>
      {appeal ? (
        <div className="grid gap-1 rounded-md bg-surface-sunken p-3 text-sm">
          <span className="font-medium">
            {t('arguments', {
              date: format.dateTime(new Date(appeal.createdAt), { dateStyle: 'medium' }),
            })}
          </span>
          <span className="whitespace-pre-line">{appeal.statement}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={routes.adminCase(item.caseId)}
          className="link-underline-hover text-sm font-medium text-accent"
        >
          {t('openCase')}
        </Link>
        {resolve.visible ? (
          item.resolvable ? (
            <ResolveDialog item={item} disabledReason={resolve.disabledReason} />
          ) : (
            <p className="max-w-md text-sm text-muted" data-appeal-refusal>
              {item.refusal === 'TRUST_SAME_MODERATOR'
                ? t('ownDecision')
                : item.refusal && errors.has(item.refusal as never)
                  ? errors(item.refusal as never)
                  : t('notResolvable')}
            </p>
          )
        ) : null}
      </div>
    </Card>
  );
}

function ResolveDialog({
  item,
  disabledReason,
}: {
  item: ModerationAppealItem;
  disabledReason: string | undefined;
}) {
  const t = useTranslations('web.admin.moderation.appeals');
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<AppealOutcome>('upheld');
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = statement.trim().length >= STATEMENT_MIN;
  async function submit() {
    if (!item.appeal) return;
    setBusy(true);
    setError(null);
    try {
      await moderationControllerResolveAppeal(item.appeal.id, {
        outcome,
        statement: statement.trim(),
      });
      announce(t('resolved'));
      setOpen(false);
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabledReason={disabledReason}>{t('resolve')}</Button>
      </DialogTrigger>
      <DialogContent title={t('resolveTitle')} description={t('resolveDescription')}>
        <div className="grid gap-4">
          <Field label={t('outcome')}>
            <RadioGroup
              variant="card"
              value={outcome}
              onValueChange={setOutcome}
              options={[
                { value: 'upheld', label: t('upheld'), description: t('upheldHint') },
                { value: 'overturned', label: t('overturned'), description: t('overturnedHint') },
              ]}
            />
          </Field>
          <Field
            label={t('statement')}
            description={t('statementHint')}
            counter={{ count: statement.length, max: STATEMENT_MAX }}
          >
            <Textarea
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              minRows={4}
              maxLength={STATEMENT_MAX}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <DialogActions>
          <Button
            loading={busy}
            loadingLabel={t('resolving')}
            disabledReason={valid ? undefined : t('statementLength', { min: STATEMENT_MIN })}
            onClick={() => void submit()}
          >
            {t('confirm')}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
