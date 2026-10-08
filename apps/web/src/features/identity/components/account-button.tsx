'use client';

import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { Avatar } from '@/components/ui';
import { useCurrentMember } from './current-member';

/** The avatar of the member as a button: the trigger of the account menu (user-menu.tsx). */
export function AccountButton(props: ComponentProps<'button'>) {
  const member = useCurrentMember();
  const t = useTranslations('web.nav');
  return (
    <button
      type="button"
      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      {...props}
    >
      <Avatar
        name={member.profile.displayName}
        src={member.profile.avatarUrl}
        size="sm"
        decorative
      />
      {/* The name comes from this text, the initials being decorative (label in name). */}
      <span className="sr-only">{t('account', { name: member.profile.displayName })}</span>
    </button>
  );
}
