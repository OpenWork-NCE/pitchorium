'use client';

import type { ProjectPaymentAvailability } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui';
import { availabilityPresentation } from '../../lib/availability';

/**
 * What a project says when its contributions are not open online (ADR 0138), one honest message
 * per code of the api, without jargon nor any promise of a date; the alternatives that need no
 * online payment come after it when they stay offered.
 */
export function AvailabilityNotice({
  availability,
  alternatives,
}: {
  availability: Exclude<ProjectPaymentAvailability, 'open'>;
  /** The ways to support without paying online (love money, interest, off-platform). */
  alternatives?: ReactNode;
}) {
  const t = useTranslations('web.payments.availability');
  const presentation = availabilityPresentation(availability);
  return (
    <div className="grid gap-3" data-availability={availability}>
      <Alert tone="info" title={t(`${availability}.title`)}>
        {t(`${availability}.body`)}
      </Alert>
      {presentation.alternatives && alternatives ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t('alternativesTitle')}</p>
          {alternatives}
        </div>
      ) : null}
    </div>
  );
}
