'use client';

import { moderationControllerDecide } from '@pitchorium/api-client';
import type {
  DecisionOptions,
  ModerationDecisionKind,
  ModerationGround,
  ReportReason,
  ReportTargetType,
} from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Button,
  Card,
  Field,
  Heading,
  Input,
  RadioGroup,
  Select,
  Switch,
  Text,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import {
  ReauthenticationNotice,
  RecentSessionHint,
  useConsoleProblem,
  useResumeEffect,
  useSensitiveAction,
} from '@/features/admin';
import { useRouter } from '@/i18n/navigation';
import {
  defaultGround,
  REPORT_REASON_KEYS,
  statementTemplateKey,
} from '../../lib/statement-templates';
import { DecisionStatement } from '../decision-statement';

/** Bounds of a statement of reasons (MODERATION_STATEMENT_* of the contracts, copied). */
export const STATEMENT_MIN = 20;
export const STATEMENT_MAX = 5_000;

/**
 * The decision on a case (§13, ADR 0072, ADR 0174): only the kinds the api offers the reader
 * (`decisionOptions`, the others disabled with their reason), a statement of reasons started
 * from the template of its reason and edited by the moderator, its ground, the length of a
 * suspension within the bounds of the role, and the preview of what the member concerned will
 * read. An irreversible decision (permanent suspension, freeze) asks for a typed phrase and a
 * recent session.
 */
export function DecisionForm({
  caseId,
  targetType,
  reasons,
  options,
}: {
  caseId: string;
  targetType: ReportTargetType;
  /** The reasons reported, the first one starts the form. */
  reasons: readonly ReportReason[];
  options: DecisionOptions;
}) {
  const t = useTranslations('web.admin.moderation.decision');
  const templates = useTranslations('web.admin.moderation.templates');
  const reference = useTranslations('reference');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const sensitive = useSensitiveAction(`decide:${caseId}`);
  const first = options.kinds.find((option) => option.allowed)?.kind ?? 'dismiss';
  const [kind, setKind] = useState<ModerationDecisionKind>(first);
  const [reason, setReason] = useState<ReportReason>(reasons[0] ?? 'other');
  const target = reference(`reportTargetTypes.${targetType}`).toLowerCase();
  const template = (nextKind: ModerationDecisionKind, nextReason: ReportReason) =>
    templates(statementTemplateKey(nextKind, nextReason), { target });
  const [statement, setStatement] = useState(() => template(first, reasons[0] ?? 'other'));
  const [edited, setEdited] = useState(false);
  const [ground, setGround] = useState<ModerationGround>(defaultGround(reasons[0] ?? null));
  const [groundReference, setGroundReference] = useState('');
  const [days, setDays] = useState(String(Math.min(7, options.suspension?.maxDays ?? 7)));
  const [permanent, setPermanent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useResumeEffect(sensitive.resumed, () => setConfirming(true), sensitive.acknowledge);

  const restart = (nextKind: ModerationDecisionKind, nextReason: ReportReason) => {
    // A statement the moderator has not touched follows the template of the new choice.
    if (!edited) setStatement(template(nextKind, nextReason));
  };
  const suspension = kind === 'suspend' ? options.suspension : null;
  const dayCount = Number.parseInt(days, 10);
  const daysValid =
    kind !== 'suspend' ||
    permanent ||
    (Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= (suspension?.maxDays ?? 0));
  const statementValid =
    statement.trim().length >= STATEMENT_MIN && statement.trim().length <= STATEMENT_MAX;
  const irreversible = kind === 'freeze_project' || (kind === 'suspend' && permanent);
  const recent =
    options.kinds.find((option) => option.kind === kind)?.recentAuthentication || irreversible;

  async function decide() {
    setError(null);
    setBusy(true);
    try {
      const outcome = await sensitive.run(() =>
        moderationControllerDecide(caseId, {
          kind,
          reason,
          statement: statement.trim(),
          ground,
          groundReference: groundReference.trim() || null,
          suspensionDays: kind === 'suspend' ? (permanent ? null : dayCount) : null,
        }),
      );
      if (!outcome.done) return;
      announce(t('decided'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-5 p-5" aria-labelledby="decision-title">
      <Heading level={2} size="card" id="decision-title">
        {t('title')}
      </Heading>
      <Field label={t('kind')}>
        <RadioGroup
          variant="card"
          value={kind}
          onValueChange={(value) => {
            setKind(value);
            restart(value, reason);
          }}
          options={options.kinds.map((option) => ({
            value: option.kind,
            label: reference(`moderationDecisionKinds.${option.kind}`),
            description: option.allowed
              ? t(`kinds.${option.kind}`)
              : option.code && errors.has(option.code as never)
                ? errors(option.code as never)
                : t(`kinds.${option.kind}`),
            disabled: !option.allowed,
          }))}
        />
      </Field>
      <Field label={t('reason')}>
        <Select
          value={reason}
          onValueChange={(value) => {
            setReason(value);
            setGround(defaultGround(value));
            restart(kind, value);
          }}
          options={REPORT_REASON_KEYS.map((value) => ({
            value,
            label: reference(`reportReasons.${value}`),
          }))}
        />
      </Field>
      <Field
        label={t('statement')}
        description={t('statementHint')}
        error={statementValid ? undefined : t('statementLength', { min: STATEMENT_MIN })}
        counter={{ count: statement.length, max: STATEMENT_MAX }}
      >
        <Textarea
          value={statement}
          onChange={(event) => {
            setStatement(event.target.value);
            setEdited(true);
          }}
          minRows={4}
          maxLength={STATEMENT_MAX}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('ground')}>
          <RadioGroup
            value={ground}
            onValueChange={setGround}
            options={(['terms', 'law'] as const).map((value) => ({
              value,
              label: reference(`moderationGrounds.${value}`),
            }))}
          />
        </Field>
        <Field label={t('groundReference')} description={t('groundReferenceHint')} optional>
          <Input
            value={groundReference}
            onChange={(event) => setGroundReference(event.target.value)}
            maxLength={300}
            autoComplete="off"
          />
        </Field>
      </div>
      {suspension ? (
        <div className="grid gap-3 rounded-md border border-border p-4">
          {suspension.permanent ? (
            <Switch
              label={t('permanent')}
              description={t('permanentHint')}
              checked={permanent}
              onCheckedChange={setPermanent}
            />
          ) : null}
          {permanent ? null : (
            <Field
              label={t('days')}
              description={t('daysHint', { max: format.number(suspension.maxDays) })}
              error={
                daysValid ? undefined : t('daysInvalid', { max: format.number(suspension.maxDays) })
              }
            >
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={suspension.maxDays}
                value={days}
                onChange={(event) => setDays(event.target.value)}
                className="max-w-32"
                autoComplete="off"
              />
            </Field>
          )}
        </div>
      ) : null}
      <section
        aria-labelledby="preview-title"
        className="grid gap-3 rounded-lg bg-surface-sunken p-4"
      >
        <Heading level={3} size="card" id="preview-title">
          {t('preview')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('previewHint')}
        </Text>
        <div className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <DecisionStatement
            decision={{
              kind,
              targetType,
              reason,
              statement: statement.trim() || t('statementEmpty'),
              ground,
              groundReference: groundReference.trim() || null,
              suspensionEndsAt: null,
              automatedDetection: false,
              decidedAt: new Date().toISOString(),
            }}
            date={(iso) => format.dateTime(new Date(iso), { dateStyle: 'long' })}
            titleId="preview-decision"
          />
          {kind === 'suspend' ? (
            <Text size="sm">
              {permanent
                ? t('previewPermanent')
                : t('previewDays', { count: format.number(dayCount || 0) })}
            </Text>
          ) : null}
        </div>
      </section>
      {recent ? <RecentSessionHint /> : null}
      {sensitive.stale ? <ReauthenticationNotice resumeKey={`decide:${caseId}`} /> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          loading={busy}
          loadingLabel={t('deciding')}
          disabledReason={
            !statementValid
              ? t('statementLength', { min: STATEMENT_MIN })
              : !daysValid
                ? t('daysInvalid', { max: format.number(suspension?.maxDays ?? 0) })
                : undefined
          }
          onClick={() => setConfirming(true)}
        >
          {t('submit')}
        </Button>
      </div>
      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone={kind === 'dismiss' || kind === 'warn' ? 'primary' : 'danger'}
        title={t('confirmTitle', { kind: reference(`moderationDecisionKinds.${kind}`) })}
        description={irreversible ? t('confirmIrreversible') : t('confirmDescription')}
        confirmLabel={t('confirm', { kind: reference(`moderationDecisionKinds.${kind}`) })}
        {...(irreversible
          ? { confirmPhrase: t(kind === 'freeze_project' ? 'phraseFreeze' : 'phrasePermanent') }
          : {})}
        onConfirm={decide}
      />
    </Card>
  );
}
