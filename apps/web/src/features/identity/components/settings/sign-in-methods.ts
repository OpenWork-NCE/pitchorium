'use client';

import { useQuery } from '@tanstack/react-query';

export const ACCOUNTS_KEY = ['identity', 'accounts'] as const;

/** Sign-in methods linked to the account (`credential` for a password), read once per page. */
export function useSignInMethods() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async () => {
      const { authClient } = await import('@/lib/auth/client');
      const result = await authClient.listAccounts();
      if (result.error) throw new Error(result.error.code ?? 'accounts');
      return result.data;
    },
  });
}
