'use client';

import { meControllerSetIntention } from '@pitchorium/api-client';
import { INTENTIONS, type Intention } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, FormActions, RadioGroup } from '@/components/ui';
import type { EditorProps } from '../profile-editor';
import { EditorDialog } from './editor-dialog';

/**
 * « Qu'est-ce qui vous amène ? » changed at any time (§7.2, step 2): it orients the suggestions,
 * locks nothing, and can be cleared.
 */
export function IntentionEditor({ own, onClose }: EditorProps) {
  const t = useTranslations('web.profile.edit.intention');
  const edit = useTranslations('web.profile.edit');
  const reference = useTranslations('reference.intentions');
  const [value, setValue] = useState<Intention | undefined>(own.intention ?? undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(intention: Intention | null) {
    setPending(true);
    setError(null);
    try {
      await meControllerSetIntention({ intention });
      onClose(true);
    } catch {
      setPending(false);
      setError(t('failed'));
    }
  }

  return (
    <EditorDialog title={t('title')} description={t('description')} onClose={() => onClose(false)}>
      <div className="grid gap-5">
        <RadioGroup
          aria-label={t('title')}
          variant="card"
          value={value}
          onValueChange={setValue}
          options={INTENTIONS.map((intention) => ({
            value: intention,
            label: reference(intention),
          }))}
        />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <FormActions>
          <Button
            loading={pending}
            loadingLabel={edit('saving')}
            disabled={!value}
            onClick={() => value && void save(value)}
          >
            {edit('save')}
          </Button>
          {own.intention ? (
            <Button variant="ghost" onClick={() => void save(null)}>
              {t('clear')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onClose(false)}>
            {edit('cancel')}
          </Button>
        </FormActions>
      </div>
    </EditorDialog>
  );
}
