import type { ImpactDashboard } from '@pitchorium/contracts';
import { getLocale, getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/format/money';
import { chartBars } from '../lib/chart';

/**
 * The money given over the last twelve months (section 9.4), an SVG drawn by the server from the
 * series of the api, without any charting library: one bar per month in the accent colour, its
 * value in a table read by screen readers and in the title of each bar.
 */
export async function EngagementChart({ monthly }: { monthly: ImpactDashboard['monthly'] }) {
  const t = await getTranslations('web.engagement.chart');
  const locale = await getLocale();
  const bars = chartBars(monthly);
  const label = (month: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
      new Date(`${month}-01T00:00:00Z`),
    );
  const long = (month: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${month}-01T00:00:00Z`),
    );
  const width = 100 / Math.max(bars.length, 1);
  return (
    <figure className="grid gap-3" aria-labelledby="engagement-chart-title">
      <figcaption id="engagement-chart-title" className="text-sm font-medium">
        {t('title')}
      </figcaption>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-40 w-full text-accent"
        aria-hidden
        data-testid="engagement-chart"
      >
        <line x1="0" y1="39.75" x2="100" y2="39.75" className="stroke-border" strokeWidth="0.5" />
        {bars.map((bar, index) => {
          const height = (bar.height / 100) * 38;
          return (
            <rect
              key={bar.month}
              x={index * width + width * 0.2}
              y={39.5 - height}
              width={width * 0.6}
              height={height}
              rx="0.6"
              className="fill-current"
            >
              <title>
                {t('bar', { month: long(bar.month), amount: formatMoney(bar.given, locale) })}
              </title>
            </rect>
          );
        })}
      </svg>
      <div
        className="grid text-xs text-muted"
        style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {bars.map((bar) => (
          <span key={bar.month} className="text-center">
            {label(bar.month)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{t('tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('month')}</th>
            <th scope="col">{t('given')}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.month}>
              <th scope="row">{long(bar.month)}</th>
              <td>{formatMoney(bar.given, locale, 'financial')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
