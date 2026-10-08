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
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node e2e/support/serve.mjs',
      startServerReadyPattern: 'Ready in',
      url: ['http://localhost:3201/fr', 'http://localhost:3201/en'],
      numberOfRuns: Number(process.env.LHCI_RUNS ?? 3),
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
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
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 1 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        // Every script of the editorial page, transferred: initial chunks plus GSAP and the Motion
        // features loaded on demand.
        'resource-summary:script:size': ['error', { maxNumericValue: 360000 }],
        'resource-summary:font:size': ['error', { maxNumericValue: 80000 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
