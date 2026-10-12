'use client';

import { adminControllerFlagHistory, adminControllerUpdateFlag } from '@pitchorium/api-client';
import type { FeatureFlagChange, FeatureFlagView } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Alert,
  AlertDialog,
  Badge,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTrigger,
  Field,
  Heading,
  Input,
  Text,
  useAnnounce,
} from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { flagGuardState } from '../lib/flag-guard';
import { useConsoleAction } from './console-access';
import {
  ReauthenticationNotice,
  RecentSessionHint,
  useResumeEffect,
  useSensitiveAction,
} from './sensitive-action';
import { useConsoleProblem } from './use-console-problem';

/** Shortest and longest legal reference (updateFeatureFlagRequestSchema). */
const REFERENCE_MIN = 3;
const REFERENCE_MAX = 300;

type Section = 'locales' | 'funding' | 'other';

function sectionOf(key: string): Section {
  if (key.startsWith('locale.')) return 'locales';
  if (key.startsWith('funding.')) return 'funding';
  return 'other';
}

/**
 * The feature flags (§13): their state, their guardrail as the api applies it (a language only
 * with a complete and reviewed catalogue, equity and loans only with a legal reference and never
 * paid online without a licensed adapter) and their history. A change asks for a recent session
 * and the key typed.
 */
export function FeatureFlags({ flags }: { flags: readonly FeatureFlagView[] }) {
  const t = useTranslations('web.admin.flags');
  const sections = (['locales', 'funding', 'other'] as const)
    .map((section) => ({ section, items: flags.filter((flag) => sectionOf(flag.key) === section) }))
    .filter((group) => group.items.length > 0);
  return (
    <div className="grid gap-8">
      {sections.map(({ section, items }) => (
        <section key={section} aria-labelledby={`flags-${section}`} className="grid gap-3">
          <Heading level={2} size="section" id={`flags-${section}`}>
            {t(`sections.${section}`)}
          </Heading>
          <ul className="grid gap-3">
            {items.map((flag) => (
              <li key={flag.key}>
                <FlagCard flag={flag} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FlagCard({ flag }: { flag: FeatureFlagView }) {
  const t = useTranslations('web.admin.flags');
  const format = useFormatter();
  const manage = useConsoleAction('admin.flags.manage');
  const guard = flagGuardState(flag);
  const titleId = `flag-${flag.key}`;
  return (
    <Card className="grid gap-3 p-5" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <Heading level={3} size="card" id={titleId} className="font-mono">
            {flag.key}
          </Heading>
          <Text size="sm" tone="muted">
            {flag.description}
          </Text>
        </div>
        <Badge tone={flag.enabled ? 'success' : 'neutral'}>{t(flag.enabled ? 'on' : 'off')}</Badge>
      </div>
      {flag.guard?.kind === 'locale' ? (
        <p className="text-sm">
          {t('locale.catalog', {
            done: flag.guard.status.catalog.total - flag.guard.status.catalog.missing,
            total: flag.guard.status.catalog.total,
          })}{' '}
          {flag.guard.status.review.reviewedBy && flag.guard.status.review.reviewedAt
            ? t('locale.reviewed', {
                by: flag.guard.status.review.reviewedBy,
                date: format.dateTime(new Date(flag.guard.status.review.reviewedAt), {
                  dateStyle: 'medium',
                }),
              })
            : t('locale.notReviewed')}
        </p>
      ) : null}
      {guard.blocked ? <Alert tone="warning">{t(`blocked.${guard.blocked}`)}</Alert> : null}
      {guard.offlineOnly ? <Alert tone="info">{t('legal.offlineOnly')}</Alert> : null}
      {flag.legalReference ? (
        <Text size="sm">{t('legal.reference', { reference: flag.legalReference })}</Text>
      ) : null}
      <Text size="sm" tone="muted">
        {t('updatedAt', {
          date: format.dateTime(new Date(flag.updatedAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
        })}
      </Text>
      <div className="flex flex-wrap items-center gap-2">
        {manage.visible ? (
          <ChangeDialog
            flag={flag}
            legalReferenceRequired={guard.legalReferenceRequired}
            disabledReason={
              manage.disabledReason ?? (guard.blocked ? t(`blocked.${guard.blocked}`) : undefined)
            }
          />
        ) : null}
        <FlagHistory flagKey={flag.key} />
      </div>
    </Card>
  );
}

function ChangeDialog({
  flag,
  legalReferenceRequired,
  disabledReason,
}: {
  flag: FeatureFlagView;
  legalReferenceRequired: boolean;
  disabledReason: string | undefined;
}) {
  const t = useTranslations('web.admin.flags');
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const resumeKey = `flag:${flag.key}`;
  const sensitive = useSensitiveAction(resumeKey);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  useResumeEffect(sensitive.resumed, () => setOpen(true), sensitive.acknowledge);
  const next = !flag.enabled;
  const referenceValid = !legalReferenceRequired || reference.trim().length >= REFERENCE_MIN;
  async function submit() {
    setError(null);
    try {
      const outcome = await sensitive.run(() =>
        adminControllerUpdateFlag(
          flag.key,
          { enabled: next, legalReference: legalReferenceRequired ? reference.trim() : null },
          { headers: { 'Idempotency-Key': key } },
        ),
      );
      if (!outcome.done) return;
      setKey(crypto.randomUUID());
      setOpen(false);
      announce(t(next ? 'enabledDone' : 'disabledDone', { key: flag.key }));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={next ? 'primary' : 'outline'} disabledReason={disabledReason}>
          {t(next ? 'enable' : 'disable')}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t(next ? 'enableTitle' : 'disableTitle', { key: flag.key })}
        description={flag.description}
      >
        <div className="grid gap-4">
          {legalReferenceRequired ? (
            <>
              <Field
                label={t('legal.field')}
                description={t('legal.fieldHint')}
                counter={{ count: reference.length, max: REFERENCE_MAX }}
              >
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={REFERENCE_MAX}
                  autoComplete="off"
                />
              </Field>
              <Alert tone="info">{t('legal.reminder')}</Alert>
            </>
          ) : null}
          <RecentSessionHint />
          {sensitive.stale ? <ReauthenticationNotice resumeKey={resumeKey} /> : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <DialogActions>
          <Button
            variant={next ? 'primary' : 'danger'}
            disabledReason={referenceValid ? undefined : t('legal.missing', { min: REFERENCE_MIN })}
            onClick={() => setConfirming(true)}
          >
            {t(next ? 'enable' : 'disable')}
          </Button>
        </DialogActions>
        <AlertDialog
          open={confirming}
          onOpenChange={setConfirming}
          tone={next ? 'primary' : 'danger'}
          title={t(next ? 'enableTitle' : 'disableTitle', { key: flag.key })}
          description={t(next ? 'confirmEnable' : 'confirmDisable')}
          confirmLabel={t(next ? 'enable' : 'disable')}
          confirmPhrase={flag.key}
          onConfirm={submit}
        />
      </DialogContent>
    </Dialog>
  );
}

function FlagHistory({ flagKey }: { flagKey: string }) {
  const t = useTranslations('web.admin.flags');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const [items, setItems] = useState<FeatureFlagChange[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelId = `history-${flagKey}`;
  async function toggle() {
    const opening = !open;
    setOpen(opening);
    if (!opening || items) return;
    setLoading(true);
    setError(null);
    try {
      setItems((await adminControllerFlagHistory(flagKey)).items);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="grid w-full gap-2">
      <Button
        size="sm"
        variant="ghost"
        className="justify-self-start"
        aria-expanded={open}
        aria-controls={panelId}
        loading={loading}
        loadingLabel={t('historyLoading')}
        onClick={() => void toggle()}
      >
        {t(open ? 'historyHide' : 'history')}
      </Button>
      <div id={panelId} hidden={!open}>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : items && items.length === 0 ? (
          <Text size="sm" tone="muted">
            {t('historyEmpty')}
          </Text>
        ) : items ? (
          <ol className="grid gap-1 text-sm">
            {items.map((change) => (
              <li key={change.changedAt} className="flex flex-wrap gap-x-2">
                <span className="font-numeric text-muted tabular-nums">
                  {format.dateTime(new Date(change.changedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                <span>
                  {t(change.enabled ? 'historyEnabled' : 'historyDisabled', {
                    name: change.changedBy?.name ?? t('commandLine'),
                  })}
                </span>
                {change.legalReference ? (
                  <span className="text-muted">
                    {t('legal.reference', { reference: change.legalReference })}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
