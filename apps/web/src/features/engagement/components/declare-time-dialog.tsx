'use client';

import { engagementControllerDeclare } from '@pitchorium/api-client';
import type { TimeEntryKind } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  Field,
  Input,
  RadioGroup,
  Select,
  Textarea,
} from '@/components/ui';
import { TIME_LIMITS } from '../lib/limits';
import type { SupportedProject } from './engagement-dashboard';
import { useProblem } from './use-time-problem';

/** Today in the time zone of the browser, as a calendar day (`2026-10-10`). */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** The declaration of hours of mentoring or expertise, for a project or an entrepreneur. */
export default function DeclareTimeDialog({
  open,
  onOpenChange,
  projects,
  onDeclared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: readonly SupportedProject[];
  onDeclared: () => void;
}) {
  const t = useTranslations('web.engagement.time.declare');
  const kinds = useTranslations('reference.timeEntryKinds');
  const problem = useProblem();
  const [target, setTarget] = useState<'project' | 'entrepreneur'>(
    projects.length > 0 ? 'project' : 'entrepreneur',
  );
  const [projectId, setProjectId] = useState<string | undefined>(projects[0]?.id);
  const [handle, setHandle] = useState('');
  const [kind, setKind] = useState<TimeEntryKind>('mentoring');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());
  const total = Number.parseInt(hours || '0', 10) * 60 + Number.parseInt(minutes || '0', 10);
  const valid =
    Number.isInteger(total) &&
    total >= 1 &&
    total <= TIME_LIMITS.maxMinutes &&
    description.trim().length > 0 &&
    (target === 'project' ? Boolean(projectId) : handle.trim().length > 0);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await engagementControllerDeclare(
        {
          ...(target === 'project'
            ? { projectId: projectId! }
            : { entrepreneurHandle: handle.trim() }),
          kind,
          minutes: total,
          date,
          description: description.trim(),
        },
        { headers: { 'Idempotency-Key': key.current } },
      );
      key.current = crypto.randomUUID();
      setDescription('');
      onDeclared();
      onOpenChange(false);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('title')} description={t('description')} size="lg">
        <div className="grid gap-5">
          <Field label={t('target')}>
            <RadioGroup
              value={target}
              onValueChange={setTarget}
              options={[
                { value: 'project' as const, label: t('project'), disabled: projects.length === 0 },
                { value: 'entrepreneur' as const, label: t('entrepreneur') },
              ]}
            />
          </Field>
          {target === 'project' ? (
            <Field label={t('projectLabel')} description={t('projectHint')}>
              <Select
                value={projectId}
                onValueChange={setProjectId}
                options={projects.map((project) => ({ value: project.id, label: project.title }))}
              />
            </Field>
          ) : (
            <Field label={t('handle')} description={t('handleHint')}>
              <Input
                value={handle}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setHandle(event.target.value)}
              />
            </Field>
          )}
          <Field label={t('kind')}>
            <RadioGroup
              value={kind}
              onValueChange={setKind}
              options={(['mentoring', 'expertise'] as const).map((value) => ({
                value,
                label: kinds(value),
              }))}
            />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('duration')}</legend>
            <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
              <Field label={t('hours')}>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  inputMode="numeric"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                />
              </Field>
              <Field label={t('minutes')}>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                />
              </Field>
            </div>
            <p className="text-sm text-muted">{t('durationHint')}</p>
          </fieldset>
          <Field label={t('date')} description={t('dateHint')}>
            <Input
              type="date"
              max={today()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field
            label={t('descriptionLabel')}
            counter={{ count: description.length, max: TIME_LIMITS.description }}
          >
            <Textarea
              value={description}
              maxLength={TIME_LIMITS.description}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          {error ? (
            <Alert tone="danger" live="alert">
              {error}
            </Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              loading={busy}
              loadingLabel={t('declaring')}
              disabledReason={valid ? undefined : t('incomplete')}
              onClick={() => void submit()}
            >
              {t('submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
