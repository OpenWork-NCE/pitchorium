'use client';

import {
  eventsControllerCancel,
  eventsControllerDelete,
  eventsControllerPublish,
} from '@pitchorium/api-client';
import type { EventStatus } from '@pitchorium/contracts';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Button,
  Dialog,
  DialogContent,
  Field,
  FormActions,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { useWithPrerequisites } from '@/features/access';
import { Link, useRouter } from '@/i18n/navigation';
import { useEventProblem } from './use-event-problem';

const REASON_MAX = 500;

/**
 * The organizers' actions on their event (ADR 0069): edit, publish a draft (verified email
 * first), delete a draft, cancel a published event with an optional reason, after a
 * confirmation that says the registered members are told by the api.
 */
export function EventManage({
  eventId,
  slug,
  status,
  title,
}: {
  eventId: string;
  slug: string;
  status: EventStatus;
  title: string;
}) {
  const t = useTranslations('web.events.manage');
  const announce = useAnnounce();
  const router = useRouter();
  const withPrerequisites = useWithPrerequisites();
  const problem = useEventProblem();
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      await withPrerequisites(() => eventsControllerPublish(eventId));
      announce(t('published'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setPublishing(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await eventsControllerCancel(eventId, { reason: reason.trim() || null });
      setCanceling(false);
      announce(t('canceled'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'canceled' || status === 'completed') return null;
  return (
    <div className="grid gap-2 border-t border-border pt-4" data-event-manage="">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={routes.eventEdit(slug)}>
            <Pencil aria-hidden />
            {t('edit')}
          </Link>
        </Button>
        {status === 'draft' ? (
          <>
            <Button
              size="sm"
              loading={publishing}
              loadingLabel={t('publishing')}
              onClick={() => void publish()}
            >
              {t('publish')}
            </Button>
            <AlertDialog
              trigger={
                <Button variant="ghost" size="sm">
                  {t('delete')}
                </Button>
              }
              title={t('deleteTitle', { title })}
              description={t('deleteBody')}
              confirmLabel={t('delete')}
              onConfirm={async () => {
                try {
                  await eventsControllerDelete(eventId);
                  announce(t('deleted'));
                  router.push(routes.events);
                } catch (failure) {
                  setError(problem(failure));
                }
              }}
            />
          </>
        ) : (
          <Dialog open={canceling} onOpenChange={setCanceling}>
            <Button variant="ghost" size="sm" onClick={() => setCanceling(true)}>
              {t('cancel')}
            </Button>
            <DialogContent
              title={t('cancelTitle', { title })}
              description={t('cancelBody')}
              size="md"
            >
              <form
                className="grid gap-5"
                onSubmit={(submit) => {
                  submit.preventDefault();
                  void cancel();
                }}
              >
                <Field label={t('reason')} description={t('reasonHint')} optional>
                  <Textarea
                    value={reason}
                    onChange={(change) => setReason(change.target.value)}
                    maxLength={REASON_MAX}
                    rows={3}
                  />
                </Field>
                <FormActions>
                  <Button
                    type="submit"
                    variant="danger"
                    loading={busy}
                    loadingLabel={t('canceling')}
                  >
                    {t('confirmCancel')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setCanceling(false)}>
                    {t('keep')}
                  </Button>
                </FormActions>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
