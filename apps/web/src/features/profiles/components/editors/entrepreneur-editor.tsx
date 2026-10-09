'use client';

import { useTranslations } from 'next-intl';
import type { EditorProps } from '../profile-editor';
import { EditorDialog } from './editor-dialog';
import { EntrepreneurForm } from './entrepreneur-form';

/** The entrepreneur facet of the owner, created, changed or removed in a dialog. */
export function EntrepreneurEditor({ own, onClose }: EditorProps) {
  const t = useTranslations('web.profile.edit.entrepreneur');
  return (
    <EditorDialog
      title={t(own.entrepreneur ? 'title' : 'createTitle')}
      description={t('description')}
      onClose={() => onClose(false)}
      size="lg"
    >
      <EntrepreneurForm
        facet={own.entrepreneur}
        onSaved={() => onClose(true)}
        onCancel={() => onClose(false)}
      />
    </EditorDialog>
  );
}
