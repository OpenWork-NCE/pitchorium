import { Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/ui';

/**
 * No methodology is published (`IMPACT_METHODOLOGY_UNAVAILABLE`, ADR 0036): no score can be
 * given or shown, and the publication of a project does not ask for one.
 */
export function MethodologyUnavailable({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const t = useTranslations('web.impact.unavailable');
  return (
    <EmptyState
      icon={<Scale />}
      headingLevel={headingLevel}
      title={t('title')}
      description={t('body')}
    />
  );
}
