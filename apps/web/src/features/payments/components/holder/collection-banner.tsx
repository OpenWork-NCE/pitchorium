'use client';

import { getAccessControllerPrerequisitesQueryOptions } from '@pitchorium/api-client';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Button } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { formatList } from '@/lib/format/list';
import { usePaymentOptions } from '../contribute/use-payment-options';

/**
 * The state of the payout and of the identity check of a project's holder, with the next action,
 * as long as its contributions are not open online (§9.5, §13): read from the api (availability
 * of the project, and for its holder what `payment.collection.open` still misses), never
 * deduced. Nothing once the contributions are open, or for a campaign that ended.
 */
export function CollectionBanner({ projectId, holder }: { projectId: string; holder: boolean }) {
  const t = useTranslations('web.payments.holder.banner');
  const elements = useTranslations('reference.prerequisiteElements');
  const locale = useLocale();
  const options = usePaymentOptions(projectId);
  const prerequisites = useQuery(
    getAccessControllerPrerequisitesQueryOptions('payment.collection.open', {
      query: { enabled: holder, staleTime: 30_000 },
    }),
  );
  const availability = options.data?.availability;
  if (
    availability !== 'holder_not_verified' &&
    availability !== 'holder_without_covered_payout_account'
  ) {
    return null;
  }
  const missing = prerequisites.data?.missing ?? [];
  return (
    <Alert
      tone="warning"
      title={t(`${availability}.title`)}
      action={
        holder ? (
          <Button asChild size="sm">
            <Link href={routes.settingsPayouts}>{t('action')}</Link>
          </Button>
        ) : undefined
      }
    >
      <span className="grid gap-1">
        <span>{t(`${availability}.${holder ? 'holder' : 'team'}`)}</span>
        {holder && missing.length > 0 ? (
          <span>
            {t('missing', {
              elements: formatList(
                missing.map((element) =>
                  elements.has(element as never) ? elements(element as never) : element,
                ),
                locale,
              ),
            })}
          </span>
        ) : null}
      </span>
    </Alert>
  );
}
