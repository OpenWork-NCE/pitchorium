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
 * authentication client loads on demand: it is not part of the first load (ADR 0094).
 */
export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async () => {
    const { authClient } = await import('@/lib/auth/client');
    await authClient.signOut();
    queryClient.clear();
    router.replace(routes.home);
  };
}

/** Sign-out button of the administration header. */
export function SignOutButton() {
  const t = useTranslations('web.nav');
  const signOut = useSignOut();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      loadingLabel={t('signingOut')}
      onClick={() => startTransition(signOut)}
    >
      <LogOut aria-hidden />
      {t('signOut')}
    </Button>
  );
}
