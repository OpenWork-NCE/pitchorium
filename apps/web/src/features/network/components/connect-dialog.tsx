'use client';

import { connectionsControllerRequest } from '@pitchorium/api-client';
import { CONNECTION_NOTE_MAX_LENGTH } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  Form,
  FormActions,
  FormField,
  Textarea,
  useAnnounce,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import type { RelationshipAction } from '../lib/relationship';

/** The note only: the handle is the one of the page. */
const noteSchema = () =>
  import('@pitchorium/contracts').then(({ createConnectionRequestSchema }) =>
    createConnectionRequestSchema.pick({ note: true }),
  );

/**
 * A connection request (§10.2): an optional note of 300 characters (« Nous nous sommes croisés
 * à… »), the acceptance of the other member required. The button behind already says
 * « En attente » while the api answers; a refusal (weekly limit, delay after a decline) shows
 * here and gives the button back. A missing prerequisite (verified email, minimum profile) opens
 * its form, then the request leaves (ADR 0105, ADR 0109).
 */
export function ConnectDialog({
  handle,
  name,
  run,
  onClose,
}: {
  handle: string;
  name: string;
  run: (action: RelationshipAction, call: () => Promise<unknown>) => Promise<unknown>;
  onClose: () => void;
}) {
  const t = useTranslations('web.network.connect');
  const announce = useAnnounce();
  const withPrerequisites = useWithPrerequisites();
  const form = useZodForm(noteSchema, { defaultValues: { note: undefined } });
  const applyProblem = useApplyProblem(form);

  async function submit({ note }: { note?: string | undefined }) {
    try {
      await run({ kind: 'request' }, () =>
        withPrerequisites(() =>
          connectionsControllerRequest({ handle, ...(note ? { note } : {}) }),
        ),
      );
    } catch (error) {
      applyProblem(error);
      return;
    }
    announce(t('sent', { name }));
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={t('title', { name })} description={t('description', { name })}>
        <Form form={form} onSubmit={submit} aria-label={t('title', { name })}>
          <FormField
            control={form.control}
            name="note"
            label={t('note')}
            description={t('noteHint')}
            optional
            maxLength={CONNECTION_NOTE_MAX_LENGTH}
            render={({ field }) => (
              <Textarea
                {...field}
                value={field.value ?? ''}
                rows={3}
                onChange={(event) =>
                  field.onChange(event.target.value === '' ? undefined : event.target.value)
                }
              />
            )}
          />
          <FormActions>
            <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('sending')}>
              {t('send')}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
          </FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
