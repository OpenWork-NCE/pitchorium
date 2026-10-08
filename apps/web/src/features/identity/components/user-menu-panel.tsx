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
import { type RefObject, useEffect, useRef, useTransition } from 'react';
import {
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
import { AccountButton } from './account-button';
import { useCurrentMember } from './current-member';
import { useSignOut } from './sign-out-button';

/**
 * Menu of the account (§6.1): profile, settings, theme, language, keyboard shortcuts and sign
 * out; the theme and the language are radio groups. Loaded after the first render by UserMenu,
 * which hands over a request made before: open it (from the keyboard: focus on the first item),
 * or give the focus back to the trigger it replaces.
 */
export function UserMenuPanel({
  defaultOpen,
  keyboard,
  focused,
}: {
  defaultOpen: boolean;
  keyboard: boolean;
  focused: RefObject<boolean>;
}) {
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
  const trigger = useRef<HTMLButtonElement>(null);
  const firstOpen = useRef(defaultOpen && keyboard);
  useEffect(() => {
    if (focused.current && !defaultOpen) trigger.current?.focus();
    if (!firstOpen.current) return;
    // Opened by a key before this code arrived: Radix did not see the key, so it focuses the
    // menu itself once its portal is mounted; the keyboard expects the first item, focused on
    // the next frames.
    firstOpen.current = false;
    let frame = 0;
    let tries = 0;
    const focusFirst = () => {
      const item = document.querySelector<HTMLElement>('[data-account-menu] [role="menuitem"]');
      if (item) item.focus();
      else if (tries++ < 10) frame = requestAnimationFrame(focusFirst);
    };
    frame = requestAnimationFrame(focusFirst);
    return () => cancelAnimationFrame(frame);
  }, [focused, defaultOpen]);

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <AccountButton ref={trigger} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" data-account-menu="">
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
