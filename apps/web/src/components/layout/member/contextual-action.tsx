'use client';

import { FolderPlus, PenSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, IconButton } from '@/components/ui';
import { routes } from '@/config/routes';
import { Can } from '@/features/access';
import { useCurrentMember } from '@/features/identity';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The action of the context (§6.1): « Créer un projet » in the projects section for a member with
 * an entrepreneur facet (the creation of a project needs one), « Publier » elsewhere and for the
 * others. Its prerequisites are asked to the api (Can): unavailable, it says why.
 */
export function ContextualAction({ display }: { display: 'button' | 'icon' }) {
  const t = useTranslations('web.nav');
  const pathname = usePathname();
  const entrepreneur = useCurrentMember().profile.facets.entrepreneur;
  const project = entrepreneur && pathname.startsWith(routes.projects);
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
