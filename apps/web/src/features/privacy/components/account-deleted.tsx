import { CircleCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button, Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

/**
 * The page once the account is deleted: a neutral confirmation, without anything of the former
 * member, the way back to the home page.
 */
export async function AccountDeleted() {
  const t = await getTranslations('web.privacy.deleted');
  return (
    <div className="grid gap-4">
      <CircleCheck aria-hidden className="size-6 text-success" />
      <Heading level={1} size="page">
        {t('title')}
      </Heading>
      <Text tone="muted">{t('body')}</Text>
      <Button asChild variant="secondary" className="justify-self-start">
        <Link href={routes.home}>{t('home')}</Link>
      </Button>
    </div>
  );
}
