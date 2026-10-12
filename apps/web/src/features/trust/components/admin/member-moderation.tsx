'use client';

import {
  moderationControllerLift,
  moderationControllerSuspendMember,
} from '@pitchorium/api-client';
import type { ModerationGround, ReportReason } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTrigger,
  Field,
  Input,
  RadioGroup,
  Select,
  Switch,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import {
  ReauthenticationNotice,
  RecentSessionHint,
  useConsoleAction,
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
import { STATEMENT_MAX, STATEMENT_MIN } from './decision-form';

/** Longest suspension (SUSPENSION_DAYS_MAX of the contracts, copied); the api bounds the role. */
const SUSPENSION_DAYS_MAX = 365;

/**
 * The suspension of a member from their file (§13, ADR 0073): a temporary one, or a permanent
 * one when the api gives it to the reader (an administrator, a recent session and a typed
 * phrase), with the same statement of reasons as a decision on a case; or the lifting of the
 * suspension in progress, motivated.
 */
export function MemberModeration({
  userId,
  name,
  suspensionId,
}: {
  userId: string;
  name: string;
  /** The suspension in progress, null when none. */
  suspensionId: string | null;
}) {
  const decide = useConsoleAction('trust.moderation.decide');
  const lift = useConsoleAction('trust.suspension.lift');
  if (suspensionId) {
    return lift.visible ? (
      <LiftDialog suspensionId={suspensionId} name={name} disabledReason={lift.disabledReason} />
    ) : null;
  }
  return decide.visible ? (
    <SuspendDialog userId={userId} name={name} disabledReason={decide.disabledReason} />
  ) : null;
}

function SuspendDialog({
  userId,
  name,
  disabledReason,
}: {
  userId: string;
  name: string;
  disabledReason: string | undefined;
}) {
  const t = useTranslations('web.admin.moderation.suspend');
  const decision = useTranslations('web.admin.moderation.decision');
  const templates = useTranslations('web.admin.moderation.templates');
  const reference = useTranslations('reference');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const permanentAccess = useConsoleAction('trust.suspension.permanent');
  const sensitive = useSensitiveAction(`suspend:${userId}`);
  const target = reference('reportTargetTypes.profile').toLowerCase();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('other');
  const [statement, setStatement] = useState(() =>
    templates(statementTemplateKey('suspend', 'other'), { target }),
  );
  const [edited, setEdited] = useState(false);
  const [ground, setGround] = useState<ModerationGround>('terms');
  const [groundReference, setGroundReference] = useState('');
  const [days, setDays] = useState('7');
  const [permanent, setPermanent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useResumeEffect(sensitive.resumed, () => setOpen(true), sensitive.acknowledge);
  const dayCount = Number.parseInt(days, 10);
  const valid =
    statement.trim().length >= STATEMENT_MIN &&
    (permanent || (Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= SUSPENSION_DAYS_MAX));
  async function suspend() {
    setError(null);
    try {
      const outcome = await sensitive.run(() =>
        moderationControllerSuspendMember(userId, {
          reason,
          statement: statement.trim(),
          ground,
          groundReference: groundReference.trim() || null,
          suspensionDays: permanent ? null : dayCount,
        }),
      );
      if (!outcome.done) return;
      announce(t('done', { name }));
      setOpen(false);
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger" className="justify-self-start" disabledReason={disabledReason}>
          {t('action')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('title', { name })} description={t('description')} size="lg">
        <div className="grid gap-4">
          <Field label={decision('reason')}>
            <Select
              value={reason}
              onValueChange={(value) => {
                setReason(value);
                setGround(defaultGround(value));
                if (!edited)
                  setStatement(templates(statementTemplateKey('suspend', value), { target }));
              }}
              options={REPORT_REASON_KEYS.map((value) => ({
                value,
                label: reference(`reportReasons.${value}`),
              }))}
            />
          </Field>
          <Field
            label={decision('statement')}
            description={decision('statementHint')}
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
          <Field label={decision('ground')}>
            <RadioGroup
              value={ground}
              onValueChange={setGround}
              options={(['terms', 'law'] as const).map((value) => ({
                value,
                label: reference(`moderationGrounds.${value}`),
              }))}
            />
          </Field>
          <Field label={decision('groundReference')} optional>
            <Input
              value={groundReference}
              onChange={(event) => setGroundReference(event.target.value)}
              maxLength={300}
              autoComplete="off"
            />
          </Field>
          {permanentAccess.visible ? (
            <Switch
              label={decision('permanent')}
              description={decision('permanentHint')}
              checked={permanent}
              onCheckedChange={setPermanent}
              disabled={!permanentAccess.allowed}
            />
          ) : null}
          {permanent ? (
            <RecentSessionHint />
          ) : (
            <Field label={decision('days')} description={t('daysHint')}>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={SUSPENSION_DAYS_MAX}
                value={days}
                onChange={(event) => setDays(event.target.value)}
                className="max-w-32"
                autoComplete="off"
              />
            </Field>
          )}
          {sensitive.stale ? <ReauthenticationNotice resumeKey={`suspend:${userId}`} /> : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <DialogActions>
          <Button
            variant="danger"
            disabledReason={valid ? undefined : decision('statementLength', { min: STATEMENT_MIN })}
            onClick={() => setConfirming(true)}
          >
            {permanent
              ? t('confirmPermanent')
              : t('confirm', { count: format.number(dayCount || 0) })}
          </Button>
        </DialogActions>
        <AlertDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t('confirmTitle', { name })}
          description={permanent ? decision('confirmIrreversible') : t('confirmDescription')}
          confirmLabel={t('action')}
          {...(permanent ? { confirmPhrase: decision('phrasePermanent') } : {})}
          onConfirm={suspend}
        />
      </DialogContent>
    </Dialog>
  );
}

function LiftDialog({
  suspensionId,
  name,
  disabledReason,
}: {
  suspensionId: string;
  name: string;
  disabledReason: string | undefined;
}) {
  const t = useTranslations('web.admin.moderation.lift');
  const decision = useTranslations('web.admin.moderation.decision');
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await moderationControllerLift(suspensionId, { statement: statement.trim() });
      announce(t('done', { name }));
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
        <Button variant="secondary" className="justify-self-start" disabledReason={disabledReason}>
          {t('action')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('title', { name })} description={t('description')}>
        <Field
          label={decision('statement')}
          counter={{ count: statement.length, max: STATEMENT_MAX }}
        >
          <Textarea
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
            minRows={3}
            maxLength={STATEMENT_MAX}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogActions>
          <Button
            loading={busy}
            loadingLabel={t('lifting')}
            disabledReason={
              statement.trim().length >= STATEMENT_MIN
                ? undefined
                : decision('statementLength', { min: STATEMENT_MIN })
            }
            onClick={() => void submit()}
          >
            {t('action')}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
