'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Dialog, DialogContent, Field, Textarea } from '@/components/ui';
import { PAYMENT_LIMITS } from '../../lib/limits';

/** The refusal of an off-platform contribution, with its reason; loaded at its first opening. */
export default function RejectDialog({
  open,
  onOpenChange,
  busy,
  onReject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onReject: (reason: string) => void;
}) {
  const t = useTranslations('web.payments.offline.item');
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('rejectTitle')} description={t('rejectDescription')} size="sm">
        <Field
          label={t('rejectReason')}
          counter={{ count: reason.length, max: PAYMENT_LIMITS.decisionReason }}
        >
          <Textarea
            value={reason}
            maxLength={PAYMENT_LIMITS.decisionReason}
            rows={3}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={busy}
            loadingLabel={t('rejecting')}
            disabledReason={reason.trim() ? undefined : t('reasonRequired')}
            onClick={() => onReject(reason.trim())}
          >
            {t('rejectAction')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
