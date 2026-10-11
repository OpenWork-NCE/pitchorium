'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Button } from '@/components/ui';
import * as routes from '@/config/paths';
import { useRouter } from '@/i18n/navigation';
import { clearComposerDraft } from '@/lib/drafts/composer-drafts';
import { sendPendingViews } from '@/lib/views/pending-views';
import { clearPersistedMutations } from '@/lib/query/persisted-mutations';
import { clearRecentSearches } from '@/lib/search/recent-searches';

/**
 * Ends the session on the api, forgets the cached data of the member, the actions kept on the
 * device (ADR 0102), the draft of the composer (ADR 0122), those of the conversations
 * (ADR 0147) and the recent searches, back to the home page; the views the page still holds leave first (ADR 0116). The
 * authentication client loads on demand: it is not part of the first load (ADR 0094).
 */
export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async () => {
    const { authClient } = await import('@/lib/auth/client');
    // The views of the page leave while the session still exists (ADR 0116).
    await sendPendingViews();
    await authClient.signOut();
    queryClient.clear();
    // The drafts of the conversations: their module loads with the sign-out only.
    const { clearMessageDrafts } = await import('@/lib/drafts/message-drafts');
    clearRecentSearches();
    await Promise.all([clearPersistedMutations(), clearComposerDraft(), clearMessageDrafts()]);
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
