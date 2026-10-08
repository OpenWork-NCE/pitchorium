'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth/client';

/** Ends the session on the api, forgets the cached data of the member, back to the home page. */
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
