'use client';

import dynamic from 'next/dynamic';

const Analytics = dynamic(() =>
  import('@vercel/analytics/next').then((module) => module.Analytics),
);
const SpeedInsights = dynamic(() =>
  import('@vercel/speed-insights/next').then((module) => module.SpeedInsights),
);

/**
 * Vercel Analytics and Speed Insights (ADR 0091), rendered only when the deployment enables them:
 * their code loads then, never as part of the first load of a page otherwise.
 */
export function VercelInsights() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
