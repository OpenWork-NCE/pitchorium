'use client';

import type { Action } from '@pitchorium/contracts';
import {
  Flag,
  Gauge,
  Gavel,
  LayoutDashboard,
  type LucideIcon,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as routes from '@/config/paths';
import { useConsoleStates } from '@/features/admin';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

type ItemKey =
  | 'dashboard'
  | 'moderation'
  | 'appeals'
  | 'transparency'
  | 'organizations'
  | 'members'
  | 'contributions'
  | 'offline'
  | 'kyc'
  | 'discrepancies'
  | 'methodologies'
  | 'highlights'
  | 'flags'
  | 'jobs'
  | 'rights'
  | 'audit';

interface Item {
  key: ItemKey;
  href: string;
  icon: LucideIcon;
  /** The action that opens the screen: the item shows only when the api offers it. */
  action: Action;
}

/** The screens of the console by group, each shown when the reader may open it (ADR 0172). */
type Group = 'overview' | 'trust' | 'payments' | 'content' | 'platform' | 'compliance';

export const ADMIN_NAV: readonly { group: Group; items: readonly Item[] }[] = [
  {
    group: 'overview',
    items: [
      { key: 'dashboard', href: routes.admin, icon: LayoutDashboard, action: 'admin.console.read' },
    ],
  },
  {
    group: 'trust',
    items: [
      {
        key: 'moderation',
        href: routes.adminModeration,
        icon: ShieldAlert,
        action: 'trust.moderation.read',
      },
      { key: 'appeals', href: routes.adminAppeals, icon: Gavel, action: 'trust.moderation.read' },
      {
        key: 'transparency',
        href: routes.adminTransparency,
        icon: Gauge,
        action: 'trust.transparency.read',
      },
      { key: 'members', href: routes.adminMembers, icon: Users, action: 'admin.members.read' },
    ],
  },
  {
    group: 'platform',
    items: [{ key: 'flags', href: routes.adminFlags, icon: Flag, action: 'admin.flags.read' }],
  },
];

/** True when the path is the screen of the item, or one of its pages. */
export function isActive(href: string, pathname: string): boolean {
  if (href === routes.admin) return pathname === routes.admin;
  if (href === routes.adminModeration) {
    return pathname === href || pathname.startsWith(`${href}/cases`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ item, onNavigate }: { item: Item; onNavigate?: (() => void) | undefined }) {
  const t = useTranslations('web.admin.nav');
  const pathname = usePathname();
  const active = isActive(item.href, pathname);
  const Glyph = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-9 items-center gap-3 rounded-md px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-focus max-sm:min-h-11',
          active
            ? 'bg-accent-subtle font-medium text-on-accent-subtle'
            : 'text-muted hover:bg-surface-sunken hover:text-foreground',
        )}
      >
        <Glyph aria-hidden className="size-4" />
        {t(item.key)}
      </Link>
    </li>
  );
}

/**
 * Side navigation of the administration (a dense internal tool, ADR 0078): the screens by group,
 * each shown only when the api gives the reader its action (ADR 0172).
 */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('web.admin.nav');
  const stateOf = useConsoleStates();
  const sections = ADMIN_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => stateOf(item.action).visible),
  })).filter((section) => section.items.length > 0);
  return (
    <nav aria-label={t('label')} className="grid gap-4">
      {sections.map((section) => (
        <div key={section.group} className="grid gap-1">
          <p
            id={`admin-nav-${section.group}`}
            className="px-3 text-xs font-medium tracking-wide text-muted uppercase"
          >
            {t(`groups.${section.group}`)}
          </p>
          <ul className="grid gap-0.5" aria-labelledby={`admin-nav-${section.group}`}>
            {section.items.map((item) => (
              <NavItem key={item.key} item={item} onNavigate={onNavigate} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
