'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { publicEnv } from '@/lib/public-env';
import { apiHealthQueryKey, fetchApiHealth } from '../api-health';

/**
 * Status of the api as the browser sees it. The first answer comes from the server render
 * (prefetched, then hydrated), the refresh goes from the browser to the public origin.
 */
export function HealthPanel({ serverOrigin }: { serverOrigin: string }) {
  const t = useTranslations('web.health');
  const { data, isFetching, refetch } = useQuery({
    queryKey: apiHealthQueryKey(serverOrigin),
    queryFn: ({ signal }) => fetchApiHealth(publicEnv.apiUrl, signal),
  });
  const up = data?.reachable === true && data.health?.status === 'ok';

  return (
    <Card className="mt-8">
      <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <dt className="text-sm text-muted">{t('api')}</dt>
        <dd className="font-mono text-sm break-all">{publicEnv.apiUrl}</dd>
        <dt className="text-sm text-muted">{t('status')}</dt>
        <dd>
          <span
            data-testid="api-status"
            className={cn(
              'inline-flex rounded-full px-3 py-1 text-sm font-medium',
              up ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger',
            )}
          >
            {up ? t('up') : t('down')}
          </span>
          {data ? (
            <span className="ml-3 text-sm text-muted">
              {t('latency', { milliseconds: data.latencyMs })}
            </span>
          ) : null}
        </dd>
        <dt className="text-sm text-muted">{t('checks')}</dt>
        <dd>
          <ul className="grid gap-1 text-sm">
            {Object.entries(data?.health?.checks ?? {}).map(([name, check]) => (
              <li key={name} className="flex gap-3">
                <span className="font-mono">{name}</span>
                <span className={check.status === 'up' ? 'text-success' : 'text-danger'}>
                  {check.status === 'up' ? t('up') : t('down')}
                </span>
              </li>
            ))}
          </ul>
        </dd>
      </dl>
      <Button
        variant="outline"
        size="sm"
        className="mt-6"
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        <RefreshCw aria-hidden />
        {t('refresh')}
      </Button>
    </Card>
  );
}
