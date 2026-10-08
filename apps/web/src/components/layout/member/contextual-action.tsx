'use client';

import { FolderPlus, PenSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, IconButton } from '@/components/ui';
import { routes } from '@/config/routes';
import { Can } from '@/features/access';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The action of the context (§6.1): create a project in the projects section, publish elsewhere.
 * Its prerequisites are asked to the api (Can): unavailable, it says why (an email to verify).
 */
export function ContextualAction({ display }: { display: 'button' | 'icon' }) {
  const t = useTranslations('web.nav');
  const pathname = usePathname();
  const project = pathname.startsWith(routes.projects);
  const label = project ? t('createProject') : t('publish');
  const href = project ? routes.createProject : routes.compose;
  const icon = project ? <FolderPlus /> : <PenSquare />;

  return (
    <Can action={project ? 'project.create' : 'content.post.create'}>
      {(access) =>
        !access.allowed ? (
          display === 'icon' ? (
            <IconButton
              label={label}
              icon={icon}
              variant="primary"
              disabledReason={access.reason}
            />
          ) : (
            <Button size="sm" disabledReason={access.reason}>
              {icon}
              {label}
            </Button>
          )
        ) : display === 'icon' ? (
          <IconButton label={label} icon={icon} variant="primary" link={<Link href={href} />} />
        ) : (
          <Button size="sm" asChild>
            <Link href={href}>
              {icon}
              {label}
            </Link>
          </Button>
        )
      }
    </Can>
  );
}
