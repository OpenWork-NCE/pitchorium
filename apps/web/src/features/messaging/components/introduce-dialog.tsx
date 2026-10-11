'use client';

import { messagingControllerPropose } from '@pitchorium/api-client';
import type { MemberCard } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  Field,
  FormActions,
  notify,
  Textarea,
} from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { useMessagingProblem } from '../hooks/use-messaging-problem';
import { useMyConnections } from '../hooks/use-my-connections';
import { MESSAGING_LIMITS } from '../lib/limits';

/**
 * « Présenter à… » (§10.4, ADR 0058): from the profile of a connection, the choice of another
 * connection and a note; each of the two then accepts or declines, and when both accept a group
 * conversation opens with the note as its first message. The api checks the rules (connected to
 * both, distinct, not already pending).
 */
export default function IntroduceDialog({
  member,
  open,
  onOpenChange,
}: {
  member: MemberCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('web.messaging.introduce');
  const problem = useMessagingProblem();
  const withPrerequisites = useWithPrerequisites();
  const connections = useMyConnections(open);
  const [second, setSecond] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ second?: string; note?: string; form?: string }>({});
  const [sending, setSending] = useState(false);
  const [key] = useState(() => crypto.randomUUID());

  const options = (connections.data ?? [])
    .filter((card) => card.handle !== member.handle)
    .map((card) => ({
      value: card.handle,
      label: card.displayName,
      ...(card.headline ? { hint: card.headline } : {}),
    }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const missing = {
      ...(second ? {} : { second: t('secondRequired') }),
      ...(note.trim() ? {} : { note: t('noteRequired') }),
    };
    setErrors(missing);
    if (!second || !note.trim()) return;
    setSending(true);
    try {
      await withPrerequisites(() =>
        messagingControllerPropose(
          { firstHandle: member.handle, secondHandle: second, note: note.trim() },
          { headers: { 'Idempotency-Key': key } },
        ),
      );
      notify.success(t('sent', { name: member.displayName }));
      onOpenChange(false);
      setSecond(null);
      setNote('');
    } catch (error) {
      setErrors({ form: problem(error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('title', { name: member.displayName })}
        description={t('description')}
        size="md"
      >
        <form onSubmit={(event) => void submit(event)} className="grid gap-5" noValidate>
          <Field label={t('second')} error={errors.second} required>
            <Combobox
              options={options}
              loading={connections.isPending}
              placeholder={t('secondPlaceholder')}
              value={second}
              onValueChange={setSecond}
            />
          </Field>
          <Field
            label={t('note')}
            description={t('noteHint')}
            error={errors.note}
            required
            counter={{ count: note.length, max: MESSAGING_LIMITS.introductionNote }}
          >
            <Textarea
              minRows={3}
              maxRows={8}
              maxLength={MESSAGING_LIMITS.introductionNote}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          {errors.form ? (
            <p role="alert" className="text-sm text-danger">
              {errors.form}
            </p>
          ) : null}
          <FormActions>
            <Button type="submit" loading={sending} loadingLabel={t('sending')}>
              {t('submit')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
