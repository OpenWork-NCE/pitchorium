import { contributionsControllerOne, followsControllerState } from '@pitchorium/api-client';
import type { Contribution } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { routes } from '@/config/routes';
import { siteConfig } from '@/config/site';
import { FollowButton } from '@/features/network';
import { ContributionReturn, contributionIdFromPath } from '@/features/payments';
import { ShareActions } from '@/features/projects';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.payments.return');
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * Return from the hosted page of a provider (§9.3, ADR 0137): only the id of the contribution is
 * read from the address, then its state from the api; the browser asks the api to read the
 * provider and follows the contribution until it is final. 404 for a contribution that is not
 * the member's.
 */
export default async function Page({
  params,
}: PageProps<'/[locale]/contributions/[contributionId]/return'>) {
  const { locale: raw, contributionId } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const id = contributionIdFromPath(contributionId);
  if (!id) notFound();
  configureServerApi();
  const contribution: Contribution | null = await contributionsControllerOne(id, {
    cache: 'no-store',
  }).catch((): null => null);
  if (!contribution) notFound();
  const project = contribution.project;
  const follow = await followsControllerState('project', project.id, { cache: 'no-store' }).catch(
    () => null,
  );
  const url = new URL(`/${locale}${routes.project(project.slug)}`, siteConfig.url).toString();
  return (
    <SingleColumnLayout width="prose">
      <ContributionReturn
        initial={contribution}
        follow={
          follow ? (
            <FollowButton
              type="project"
              targetKey={project.id}
              name={project.title}
              initial={follow}
            />
          ) : null
        }
        share={<ShareActions url={url} title={project.title} />}
      />
    </SingleColumnLayout>
  );
}
