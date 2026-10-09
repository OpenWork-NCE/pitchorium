import { organizationsControllerMine } from '@pitchorium/api-client';
import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Avatar, Button, Card, EmptyState, Heading, Text, VerifiedBadge } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { canManage } from '../lib/roles';

/**
 * « Mes organisations »: those of the member with their role, the way to each page and to its
 * management (or, for a simple member, to leave it), and the creation of a new one.
 */
export async function MyOrganizations() {
  const t = await getTranslations('web.organizations.mine');
  const roles = await getTranslations('reference.organizationRoles');
  const { items } = await organizationsControllerMine({ cache: 'no-store' });
  const create = (
    <Button asChild>
      <Link href={routes.createOrganization}>
        <Plus aria-hidden />
        {t('create')}
      </Link>
    </Button>
  );
  return (
    <Card className="grid gap-4" aria-labelledby="organizations-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <Heading level={2} size="card" id="organizations-title">
            {t('title')}
          </Heading>
          <Text size="sm" tone="muted">
            {t('description')}
          </Text>
        </div>
        {items.length > 0 ? create : null}
      </div>
      {items.length === 0 ? (
        <EmptyState size="inline" title={t('empty')} description={t('emptyHint')} action={create} />
      ) : (
        <ul className="grid gap-1" aria-label={t('title')}>
          {items.map((organization) => (
            <li key={organization.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
              <Avatar
                name={organization.name}
                src={organization.logoUrl}
                size="md"
                shape="square"
                decorative
              />
              <div className="grid min-w-0 flex-1 basis-40 gap-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <Link
                    href={routes.organization(organization.slug)}
                    className="link-underline-hover font-medium"
                  >
                    {organization.name}
                  </Link>
                  {organization.verified ? <VerifiedBadge /> : null}
                </span>
                <span className="text-xs text-muted">{roles(organization.role)}</span>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={
                    canManage(organization.role)
                      ? routes.organizationManage(organization.slug)
                      : `${routes.organizationManage(organization.slug)}?tab=members`
                  }
                >
                  {t(canManage(organization.role) ? 'manage' : 'membership')}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
