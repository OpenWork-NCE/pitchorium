import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

/**
 * In place of the feed of a suspended account (ADR 0073, 0166): the api refuses its reading, so
 * the page says what stays open and leads to the decision, rather than an error to retry.
 */
export function SuspendedState() {
  const t = useTranslations('web.trust.suspended');
  return (
    <EmptyState
      icon={<ShieldAlert />}
      title={t('title')}
      description={t('body')}
      action={
        <Button asChild>
          <Link href={routes.settingsModeration}>{t('action')}</Link>
        </Button>
      }
    />
  );
}
