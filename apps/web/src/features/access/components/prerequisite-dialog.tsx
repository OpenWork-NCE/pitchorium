'use client';

import type { PrerequisiteElement } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { Button, Dialog, DialogContent } from '@/components/ui';
import type { PrerequisiteFormProps } from './prerequisite-gate';

/**
 * The form of one missing element in a dialog (a sheet from the bottom on a phone): what is
 * missing, the form, and « Plus tard », which gives the refusal back to the action.
 */
export function PrerequisiteDialog({
  element,
  Form,
  onDone,
  onClose,
}: {
  element: PrerequisiteElement;
  Form: ComponentType<PrerequisiteFormProps>;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('web.prerequisites');
  const elements = useTranslations('reference.prerequisiteElements');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={t('title', { element: elements(element) })}
        description={t('description')}
        footer={
          <Button variant="ghost" onClick={onClose}>
            {t('later')}
          </Button>
        }
      >
        <Form key={element} onDone={onDone} />
      </DialogContent>
    </Dialog>
  );
}
