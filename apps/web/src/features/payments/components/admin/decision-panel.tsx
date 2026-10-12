'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Field, RadioGroup, Textarea } from '@/components/ui';

/** Longest reason of a decision (DECISION_REASON_MAX_LENGTH of the contracts). */
const REASON_MAX = 1_000;

/**
 * A motivated decision of a payments review (off-platform contribution, KYC): approve or refuse,
 * with the reason shared with the member; the api decides whether it may be taken.
 */
export function DecisionPanel<Decision extends string>({
  approve,
  reject,
  labels,
  disabledReason,
  onDecide,
}: {
  approve: Decision;
  reject: Decision;
  labels: { approve: string; approveHint: string; reject: string; rejectHint: string };
  disabledReason: string | undefined;
  onDecide: (decision: Decision, reason: string) => Promise<void>;
}) {
  const t = useTranslations('web.admin.payments.decision');
  const [decision, setDecision] = useState<Decision>(approve);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await onDecide(decision, reason.trim());
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4">
      <Field label={t('decision')}>
        <RadioGroup
          variant="card"
          value={decision}
          onValueChange={setDecision}
          options={[
            { value: approve, label: labels.approve, description: labels.approveHint },
            { value: reject, label: labels.reject, description: labels.rejectHint },
          ]}
        />
      </Field>
      <Field
        label={t('reason')}
        description={t('reasonHint')}
        counter={{ count: reason.length, max: REASON_MAX }}
      >
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minRows={3}
          maxLength={REASON_MAX}
        />
      </Field>
      <div className="flex justify-end">
        <Button
          loading={busy}
          loadingLabel={t('deciding')}
          disabledReason={
            disabledReason ?? (reason.trim().length === 0 ? t('reasonMissing') : undefined)
          }
          onClick={() => void submit()}
        >
          {decision === approve ? labels.approve : labels.reject}
        </Button>
      </div>
    </div>
  );
}
