import { HandHeart } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';

/**
 * « Contribuer » for a visitor of an open campaign: signing in comes first, then the journey
 * opens on the page of the project (`?contribute=kind`), where the api says whether the project
 * takes payments. A closed or frozen campaign shows no such action (§4: no cosmetic button).
 */
export async function VisitorContribute({ path }: { path: string }) {
  const t = await getTranslations('web.payments.entry');
  return (
    <Button asChild className="w-full" data-bar-main="">
      <Link href={withRedirect(routes.signIn, `${path}?contribute=kind`)}>
        <HandHeart aria-hidden />
        {t('signInToContribute')}
      </Link>
    </Button>
  );
}
