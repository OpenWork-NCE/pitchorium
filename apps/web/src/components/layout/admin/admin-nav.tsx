'use client';

import { Flag, LayoutDashboard, type LucideIcon, ShieldAlert, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { routes } from '@/config/routes';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const ITEMS: readonly {
  key: 'dashboard' | 'moderation' | 'members' | 'flags';
  href: string;
  icon: LucideIcon;
}[] = [
  { key: 'dashboard', href: routes.admin, icon: LayoutDashboard },
  { key: 'moderation', href: routes.adminModeration, icon: ShieldAlert },
  { key: 'members', href: routes.adminMembers, icon: Users },
  { key: 'flags', href: routes.adminFlags, icon: Flag },
];

/** Side navigation of the administration (a dense internal tool, ADR 0078). */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('web.admin.nav');
  const pathname = usePathname();
  return (
    <nav aria-label={t('label')}>
      <ul className="grid gap-0.5">
        {ITEMS.map((item) => {
          const active =
            item.href === routes.admin ? pathname === routes.admin : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-focus max-sm:min-h-11',
                  active
                    ? 'bg-accent-subtle font-medium text-on-accent-subtle'
                    : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                )}
              >
                <Icon aria-hidden className="size-4" />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
