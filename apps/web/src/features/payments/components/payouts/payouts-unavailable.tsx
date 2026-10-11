import { getLocale, getTranslations } from 'next-intl/server';
import { Alert, Button } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { formatList } from '@/lib/format/list';

/**
 * The payout section for a member who misses what the api requires before configuring a payout
 * (`payment.payout.configure`): the elements it lists, translated, and the way to the profile
 * where the entrepreneur facet is added. No rule of the web app (ADR 0109).
 */
export async function PayoutsUnavailable({ missing }: { missing: readonly string[] }) {
  const t = await getTranslations('web.payments.payouts.unavailable');
  const elements = await getTranslations('reference.prerequisiteElements');
  const locale = await getLocale();
  return (
    <Alert
      tone="info"
      title={t('title')}
      action={
        <Button asChild size="sm" variant="outline">
          <Link href={routes.profile}>{t('action')}</Link>
        </Button>
      }
    >
      {t('body', {
        elements: formatList(
          missing.map((element) =>
            elements.has(element as never) ? elements(element as never) : element,
          ),
          locale,
        ),
      })}
    </Alert>
  );
}
