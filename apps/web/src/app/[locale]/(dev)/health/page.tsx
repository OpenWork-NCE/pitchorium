import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { asLocale } from '@/i18n/routing';
import { apiHealthQueryKey, fetchApiHealth, HealthPanel } from '@/features/dev';
import { serverApiOrigin } from '@/lib/api/origin';
import { getServerQueryClient } from '@/lib/query/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** State of the api, in development only: prefetched on the server, hydrated in the browser. */
export default async function HealthPage({ params }: PageProps<'/[locale]/health'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const t = await getTranslations('web.health');
  const origin = serverApiOrigin();
  const queryClient = getServerQueryClient();
  await queryClient.prefetchQuery({
    queryKey: apiHealthQueryKey(origin),
    queryFn: () => fetchApiHealth(origin),
  });

  return (
    <Container className="py-16">
      <h1 className="text-3xl">{t('title')}</h1>
      <p className="mt-3 text-muted">{t('description')}</p>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <HealthPanel serverOrigin={origin} />
      </HydrationBoundary>
    </Container>
  );
}
