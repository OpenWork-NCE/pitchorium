'use client';

import { meControllerChangeHandle } from '@pitchorium/api-client';
import { changeHandleRequestSchema, HANDLE_MAX_LENGTH } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import {
  Button,
  Callout,
  Form,
  FormActions,
  FormField,
  Input,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';
import type { EditorProps } from '../profile-editor';
import { EditorDialog } from './editor-dialog';

/**
 * The public handle of the profile, its address (§10.1): the new address is shown as it is
 * typed; the former one keeps leading to the profile (a permanent redirect of the api) and stays
 * reserved to it, so that links already shared keep working.
 */
export function HandleEditor({ own, locale, onClose }: EditorProps) {
  const t = useTranslations('web.profile.edit.handle');
  const edit = useTranslations('web.profile.edit');
  const router = useRouter();
  const form = useZodForm(changeHandleRequestSchema, { defaultValues: { handle: own.handle } });
  const applyProblem = useApplyProblem(form);
  const handle = form.watch('handle');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const address = (value: string) => `${origin}/${locale}${routes.member(value)}`;

  async function submit({ handle: next }: { handle: string }) {
    if (next === own.handle) {
      onClose(false);
      return;
    }
    try {
      await meControllerChangeHandle({ handle: next });
    } catch (error) {
      applyProblem(error);
      return;
    }
    onClose(false);
    router.replace(routes.member(next));
  }

  return (
    <EditorDialog title={t('title')} description={t('description')} onClose={() => onClose(false)}>
      <Form form={form} onSubmit={submit} aria-label={t('title')}>
        <FormField
          control={form.control}
          name="handle"
          label={t('label')}
          description={t('hint')}
          maxLength={HANDLE_MAX_LENGTH}
          render={({ field }) => (
            <Input
              {...field}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => field.onChange(event.target.value.toLowerCase())}
            />
          )}
        />
        <div className="grid gap-1 text-sm" aria-live="polite">
          <span className="text-muted">{t('newAddress')}</span>
          <code className="font-mono break-all">{address(handle || own.handle)}</code>
        </div>
        {handle && handle !== own.handle ? (
          <Callout title={t('redirectTitle')}>
            {t('redirectBody', { previous: address(own.handle) })}
          </Callout>
        ) : null}
        <FormActions>
          <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={edit('saving')}>
            {t('submit')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onClose(false)}>
            {edit('cancel')}
          </Button>
        </FormActions>
      </Form>
    </EditorDialog>
  );
}
