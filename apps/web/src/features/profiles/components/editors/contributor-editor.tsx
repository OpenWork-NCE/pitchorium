'use client';

import { useTranslations } from 'next-intl';
import type { EditorProps } from '../profile-editor';
import { ContributorForm } from './contributor-form';
import { EditorDialog } from './editor-dialog';

/** The contributor facet of the owner, created, changed or removed in a dialog. */
export function ContributorEditor({ own, onClose }: EditorProps) {
  const t = useTranslations('web.profile.edit.contributor');
  return (
    <EditorDialog
      title={t(own.contributor ? 'title' : 'createTitle')}
      description={t('description')}
      onClose={() => onClose(false)}
      size="lg"
    >
      <ContributorForm
        facet={own.contributor}
        onSaved={() => onClose(true)}
        onCancel={() => onClose(false)}
      />
    </EditorDialog>
  );
}
