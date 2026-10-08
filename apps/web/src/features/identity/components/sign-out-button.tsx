'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';

/**
 * Ends the session on the api, forgets the cached data of the member, back to the home page. The
 * authentication client loads on the click only: it is not part of the first load (ADR 0094).
 */
export function SignOutButton() {
  const t = useTranslations('web.nav');
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { authClient } = await import('@/lib/auth/client');
          await authClient.signOut();
          queryClient.clear();
          router.replace(routes.home);
        })
      }
    >
      <LogOut aria-hidden />
      {t('signOut')}
    </Button>
  );
}
