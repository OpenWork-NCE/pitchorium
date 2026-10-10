import {
  engagementControllerMine,
  engagementControllerOrganization,
  organizationsControllerMine,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading } from '@/components/ui';
import { routes } from '@/config/routes';
import { EngagementDashboard } from '@/features/engagement';
import { MyContributions, MyOffline } from '@/features/payments';
import { Link } from '@/i18n/navigation';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { cn } from '@/lib/cn';
import { memberSupportedProjects, organizationSupportedProjects } from './read-supported';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.engagement.dashboard');
  return { title: t('title'), robots: { index: false, follow: false } };
}

const RUNNERS = new Set(['owner', 'admin']);

/**
 * The engagement dashboard (§9.4, ADR 0141): the member's own, or one of an organisation they
 * run (`?organization=<slug>`, `owner` or `admin`); 404 for any other organisation.
 */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/dashboard'>) {
  setRequestLocale(asLocale((await params).locale));
  const asked = (await searchParams).organization;
  const slug = typeof asked === 'string' ? asked : null;
  const t = await getTranslations('web.engagement.dashboard');
  configureServerApi();
  const mine = await organizationsControllerMine({ cache: 'no-store' }).catch(() => null);
  const runs = (mine?.items ?? []).filter((organization) => RUNNERS.has(organization.role));
  const organization = slug ? runs.find((entry) => entry.slug === slug) : null;
  if (slug && !organization) notFound();
  const [dashboard, projects] = organization
    ? await Promise.all([
        engagementControllerOrganization(organization.id, { cache: 'no-store' }),
        organizationSupportedProjects(organization.slug),
      ])
    : await Promise.all([
        engagementControllerMine({ cache: 'no-store' }),
        memberSupportedProjects(),
      ]);
  const tab = (href: string, label: string, current: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm font-medium',
        current ? 'bg-accent-subtle text-on-accent-subtle' : 'text-muted hover:bg-surface-sunken',
      )}
    >
      {label}
    </Link>
  );
  return (
    <SingleColumnLayout>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Heading level={1} size="page">
            {organization ? t('organizationTitle', { name: organization.name }) : t('title')}
          </Heading>
          <p className="text-muted">{t('description')}</p>
        </div>
        {runs.length > 0 ? (
          <nav aria-label={t('views')} className="flex flex-wrap gap-2">
            {tab(routes.dashboard, t('mine'), !organization)}
            {runs.map((entry) =>
              tab(
                `${routes.dashboard}?organization=${encodeURIComponent(entry.slug)}`,
                entry.name,
                entry.slug === organization?.slug,
              ),
            )}
          </nav>
        ) : null}
        <EngagementDashboard
          dashboard={dashboard}
          projects={projects}
          organizationId={organization?.id ?? null}
        >
          {organization ? null : (
            <>
              <MyContributions />
              <MyOffline />
            </>
          )}
        </EngagementDashboard>
      </div>
    </SingleColumnLayout>
  );
}
