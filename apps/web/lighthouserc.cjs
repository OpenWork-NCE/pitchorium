/**
 * Budgets of the web app (docs/architecture/frontend.md, ADR 0090): mobile profile of
 * Lighthouse (Moto G class screen, slow 4G: 150 ms RTT, 1.6 Mbit/s, CPU slowed 4 times), median
 * of three runs per page. The throttling is applied to the browser ('devtools') rather than
 * simulated: on a local server the simulation ties the LCP of a server-rendered title to every
 * script run before the first paint. The slowdown follows the CPU of the host (LHCI_CPU_SLOWDOWN,
 * 4 by default, as Lighthouse recommends for a desktop-class runner). Total Blocking Time measures
 * the start of React and Next.js; INP itself is measured on real interactions by Playwright
 * (e2e/responsiveness.spec.ts). The initial JavaScript per route group is checked on the build by
 * scripts/check-bundles.mjs; the script budget below also counts the chunks loaded on demand.
 */
/** Thresholds of every page (ADR 0090). */
const THRESHOLDS = {
  'categories:performance': ['error', { minScore: 0.9 }],
  'categories:accessibility': ['error', { minScore: 1 }],
  'categories:best-practices': ['error', { minScore: 1 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
  'total-blocking-time': ['error', { maxNumericValue: 300 }],
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node e2e/support/serve.mjs',
      startServerReadyPattern: 'Ready in',
      url: [
        'http://localhost:3201/fr',
        'http://localhost:3201/en',
        'http://localhost:3201/fr/feed',
      ],
      numberOfRuns: Number(process.env.LHCI_RUNS ?? 3),
      settings: {
        // Reduced motion: the accessibility audit judges the contrast at rest, not in the middle
        // of a reveal (docs/design/motion.md); the loading path is the same.
        chromeFlags: '--no-sandbox --headless=new --force-prefers-reduced-motion',
        // Session of a demonstration account of the stub api, for the shell of the member space:
        // the cookie reaches the server render; the browser calls of the api carry the header.
        extraHeaders: JSON.stringify({
          Cookie: 'pitchorium.session_token=aissatou.ba%40demo.pitchorium.test',
          'X-Stub-Session': 'aissatou.ba@demo.pitchorium.test',
        }),
        throttlingMethod: 'devtools',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 562.5,
          downloadThroughputKbps: 1474.56,
          uploadThroughputKbps: 675,
          cpuSlowdownMultiplier: Number(process.env.LHCI_CPU_SLOWDOWN ?? 4),
        },
      },
    },
    assert: {
      assertMatrix: [
        {
          // Editorial pages: every category, the scripts and fonts they transfer.
          matchingUrlPattern: 'localhost:3201/(fr|en)$',
          assertions: {
            ...THRESHOLDS,
            'categories:seo': ['error', { minScore: 1 }],
            // Every script of the editorial page, transferred: initial chunks plus GSAP and the
            // chunks loaded on demand.
            'resource-summary:script:size': ['error', { maxNumericValue: 360000 }],
            'resource-summary:font:size': ['error', { maxNumericValue: 80000 }],
          },
        },
        {
          // Shell of the member space: the same thresholds, without SEO (its pages are not
          // indexed, `noindex` by design); its initial JavaScript is budgeted by check:bundles.
          // Total Blocking Time under 250 ms on every run, not on the median.
          matchingUrlPattern: 'localhost:3201/fr/feed$',
          assertions: {
            ...THRESHOLDS,
            'total-blocking-time': [
              'error',
              { maxNumericValue: 250, aggregationMethod: 'pessimistic' },
            ],
          },
        },
      ],
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
