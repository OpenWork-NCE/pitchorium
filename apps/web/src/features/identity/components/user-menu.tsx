'use client';

import {
  CircleUser,
  Keyboard,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useTransition } from 'react';
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  useShortcutsHelp,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useMemberLocaleChange } from '@/features/localization';
import { Link } from '@/i18n/navigation';
import { useCurrentMember } from './current-member';
import { useSignOut } from './sign-out-button';

/**
 * Menu of the account (§6.1): profile, settings, theme, language, keyboard shortcuts and sign
 * out. The avatar of the member is its trigger; the theme and the language are radio groups.
 */
export function UserMenu() {
  const member = useCurrentMember();
  const t = useTranslations('web.nav');
  const theme = useTranslations('web.theme');
  const localeT = useTranslations('web.locale');
  const locale = useLocale();
  const { theme: current, setTheme } = useTheme();
  const { locales, change } = useMemberLocaleChange();
  const openHelp = useShortcutsHelp();
  const signOut = useSignOut();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel className="grid gap-0.5 py-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {member.profile.displayName}
          </span>
          <span className="truncate text-xs">@{member.profile.handle}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={routes.profile}>
              <CircleUser aria-hidden />
              {t('profile')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={routes.settings}>
              <Settings aria-hidden />
              {t('settings')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun aria-hidden />
            {theme('label')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={current ?? 'system'} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun aria-hidden />
                {theme('light')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon aria-hidden />
                {theme('dark')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor aria-hidden />
                {theme('system')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {locales.length > 1 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Languages aria-hidden />
              {localeT('label')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={locale} onValueChange={(next) => void change(next)}>
                {locales.map((code) => (
                  <DropdownMenuRadioItem key={code} value={code} lang={code}>
                    {localeT(`names.${code}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuItem onSelect={openHelp}>
          <Keyboard aria-hidden />
          {t('shortcuts')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={() => startTransition(signOut)}>
          <LogOut aria-hidden />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
