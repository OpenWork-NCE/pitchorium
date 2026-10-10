import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { routes } from '@/config/routes';
import { siteConfig } from '@/config/site';
import { LazyContributeEntry, VisitorContribute } from '@/features/payments';
import { countryNames, ProjectPage, projectJsonLd } from '@/features/projects';
import { asLocale } from '@/i18n/routing';
import { resourceMetadata } from '@/lib/resources/metadata';
import { jsonLd } from '@/lib/seo/json-ld';
import { readMemberContext, readProject } from './read-project';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const resource = await readProject(slug);
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.project(resource?.data.slug ?? slug),
    resource,
    resource?.data.title,
  );
  // A draft (its team only) is never indexed, whatever the view.
  if (resource?.data.status === 'draft')
    return { ...metadata, robots: { index: false, follow: false } };
  return resource?.data.summary ? { ...metadata, description: resource.data.summary } : metadata;
}

/**
 * Page of a project (§11.2), one address for visitors and members (ADR 0101): the public view,
 * indexable with its structured data (ADR 0128); the member view, enriched (follow, interest,
 * documents, indicative equivalent); a draft for its team only, never indexed; 404 otherwise. A
 * former slug redirects to the current one.
 */
export default async function Page({ params }: PageProps<'/[locale]/projects/[slug]'>) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const resource = await readProject(slug);
  if (!resource) notFound();
  const project = resource.data;
  if (project.slug !== slug) permanentRedirect(`/${locale}${routes.project(project.slug)}`);
  const path = `/${locale}${routes.project(project.slug)}`;
  const url = new URL(path, siteConfig.url).toString();
  const context =
    resource.view === 'member' && project.status !== 'draft'
      ? await readMemberContext(project.id)
      : { follow: null, parity: null };
  // « Contribuer » (ADR 0136): the availability is the api's, read by the member's browser; a
  // visitor of an open campaign signs in first.
  const open =
    (project.status === 'funding' || project.status === 'funded') && !project.fundingFrozen;
  const entry = {
    id: project.id,
    slug: project.slug,
    title: project.title,
    instruments: project.funding.instruments,
    rewards: project.rewards,
  };
  const contribute =
    project.status === 'draft'
      ? null
      : resource.view === 'member'
        ? {
            block: <LazyContributeEntry project={entry} layout="stack" />,
            bar: <LazyContributeEntry project={entry} layout="bar" />,
          }
        : resource.view === 'visitor' && open
          ? { block: <VisitorContribute path={path} />, bar: <VisitorContribute path={path} /> }
          : null;
  return (
    <SingleColumnLayout width="page">
      <ProjectPage
        project={project}
        locale={locale}
        view={resource.view}
        url={url}
        path={path}
        follow={context.follow}
        parity={context.parity}
        contribute={contribute}
      />
      {resource.view === 'visitor' ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              projectJsonLd(project, {
                url,
                siteUrl: siteConfig.url,
                locale,
                countries: countryNames(project.countryCodes, locale),
              }),
            ),
          }}
        />
      ) : null}
    </SingleColumnLayout>
  );
}
