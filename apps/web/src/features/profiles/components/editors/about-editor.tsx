'use client';

import { meControllerUpdateProfile } from '@pitchorium/api-client';
import { BIO_MAX_LENGTH, updateBaseProfileRequestSchema } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import {
  Button,
  Form,
  FormActions,
  FormField,
  Textarea,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import type { EditorProps } from '../profile-editor';
import { EditorDialog, orNull } from './editor-dialog';

const aboutSchema = updateBaseProfileRequestSchema.pick({ bio: true });

/** The presentation of the member (§10.1), 2 600 characters at most; empty, it is removed. */
export function AboutEditor({ own, onClose }: EditorProps) {
  const t = useTranslations('web.profile.edit');
  const form = useZodForm(aboutSchema, {
    defaultValues: { bio: own.bio } as { bio?: string | null },
  });
  const applyProblem = useApplyProblem(form);

  async function submit({ bio }: { bio?: string | null }) {
    try {
      await meControllerUpdateProfile({ bio: orNull(bio) });
    } catch (error) {
      applyProblem(error);
      return;
    }
    onClose(true);
  }

  return (
    <EditorDialog title={t('about.title')} onClose={() => onClose(false)} size="lg">
      <Form form={form} onSubmit={submit} aria-label={t('about.title')}>
        <FormField
          control={form.control}
          name="bio"
          label={t('fields.bio')}
          description={t('fields.bioHint')}
          optional
          maxLength={BIO_MAX_LENGTH}
          render={({ field }) => <Textarea {...field} value={field.value ?? ''} rows={8} />}
        />
        <FormActions>
          <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('saving')}>
            {t('save')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onClose(false)}>
            {t('cancel')}
          </Button>
        </FormActions>
      </Form>
    </EditorDialog>
  );
}
