import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import boundaries from 'eslint-plugin-boundaries';

const MODULE_ELEMENTS = ['module', 'module-layer'];

/** A module imports another module through its public index.ts only. */
const MODULE_PUBLIC_API = {
  from: { element: { types: { anyOf: MODULE_ELEMENTS } } },
  disallow: {
    to: [
      {
        element: {
          type: 'module-layer',
          captured: { module: '!{{ from.element.captured.module }}' },
        },
      },
      {
        element: {
          type: 'module',
          captured: { module: '!{{ from.element.captured.module }}' },
          fileInternalPath: '!index.ts',
        },
      },
    ],
  },
  message:
    'Module "{{ from.element.captured.module }}" may only import the public index.ts of module "{{ to.element.captured.module }}".',
};

/** Entry points import modules through their public index.ts only. */
const ENTRY_POINTS = {
  from: { element: { type: 'app' } },
  disallow: {
    to: [
      { element: { type: 'module-layer' } },
      { element: { type: 'module', fileInternalPath: '!index.ts' } },
    ],
  },
  message: 'Entry points may only import the public index.ts of a module.',
};

/** platform/ does not know the business modules. */
const PLATFORM_INDEPENDENCE = {
  from: { element: { types: { anyOf: ['platform', 'platform-kernel'] } } },
  disallow: { to: { element: { types: { anyOf: MODULE_ELEMENTS } } } },
  message: 'platform/ must not depend on business modules.',
};

/** domain/ is plain TypeScript: no framework, no ORM, no Node.js API. */
const DOMAIN_PURITY = {
  from: { element: { type: 'module-layer', captured: { layer: 'domain' } } },
  disallow: {
    to: [
      { element: { type: 'module-layer', captured: { layer: '!domain' } } },
      { element: { types: { anyOf: ['module', 'platform', 'app'] } } },
      { module: { origin: 'external', source: '!@pitchorium/contracts' } },
      { module: { origin: 'core' } },
    ],
  },
  message: 'domain/ may only import its own domain, platform/kernel and @pitchorium/contracts.',
};

/**
 * Architecture rules of apps/server. Elements are folders, matched from the package root.
 *
 * @param {{ rootDir: string }} options
 */
export function serverBoundaries({ rootDir }) {
  const modulesDir = join(rootDir, 'src/modules');
  const moduleNames = readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return [
    {
      files: ['src/**/*.ts'],
      plugins: { boundaries },
      settings: {
        'boundaries/root-path': rootDir,
        'boundaries/include': ['src/**/*.ts'],
        'boundaries/elements': [
          { type: 'platform-kernel', pattern: 'src/platform/kernel', partialMatch: false },
          { type: 'platform', pattern: 'src/platform', partialMatch: false },
          {
            type: 'module-layer',
            pattern: 'src/modules/*/*',
            capture: ['module', 'layer'],
            partialMatch: false,
          },
          { type: 'module', pattern: 'src/modules/*', capture: ['module'], partialMatch: false },
          { type: 'app', pattern: 'src', partialMatch: false },
        ],
        'import/resolver': {
          typescript: { alwaysTryTypes: true, project: join(rootDir, 'tsconfig.json') },
        },
      },
      rules: {
        'boundaries/dependencies': [
          'error',
          {
            default: 'allow',
            checkAllOrigins: true,
            policies: [MODULE_PUBLIC_API, ENTRY_POINTS, PLATFORM_INDEPENDENCE, DOMAIN_PURITY],
          },
        ],
      },
    },
    {
      // Unit tests sit next to the code they test, domain/ included, and import vitest: they may
      // use every layer of their own module, never the internals of another one.
      files: ['src/**/*.spec.ts'],
      rules: {
        'boundaries/dependencies': [
          'error',
          {
            default: 'allow',
            checkAllOrigins: true,
            policies: [MODULE_PUBLIC_API, ENTRY_POINTS, PLATFORM_INDEPENDENCE],
          },
        ],
      },
    },
    ...moduleNames.flatMap((name) => {
      const ownSchemaOnly = {
        regex: `^@pitchorium/db/schemas/(?!${name}$)`,
        message: `Module "${name}" may only use its own database schema.`,
      };
      // Workspace packages resolve as local files, outside the elements above.
      const contractsOnly = {
        regex: '^@pitchorium/(?!contracts$)',
        message: 'domain/ may only import @pitchorium/contracts among workspace packages.',
      };
      return [
        {
          files: [`src/modules/${name}/**/*.ts`],
          rules: { 'no-restricted-imports': ['error', { patterns: [ownSchemaOnly] }] },
        },
        {
          files: [`src/modules/${name}/domain/**/*.ts`],
          rules: {
            'no-restricted-imports': ['error', { patterns: [ownSchemaOnly, contractsOnly] }],
          },
        },
      ];
    }),
  ];
}

/** components/ui, motion and brand know nothing of the business: no feature, no shell, no route. */
const WEB_DESIGN_SYSTEM = {
  from: { element: { types: { anyOf: ['web-ui', 'web-motion', 'web-brand'] } } },
  disallow: { to: { element: { types: { anyOf: ['web-feature', 'web-layout', 'web-app'] } } } },
  message:
    'components/ui, components/motion and components/brand are the design system: they never import a feature, a shell or a route.',
};

/** A feature reaches another feature through its public index.ts only. */
const WEB_FEATURE_PUBLIC_API = {
  from: { element: { type: 'web-feature' } },
  disallow: {
    to: {
      element: {
        type: 'web-feature',
        captured: { feature: '!{{ from.element.captured.feature }}' },
        fileInternalPath: '!index.ts',
      },
    },
  },
  message:
    'Feature "{{ from.element.captured.feature }}" may only import the public index.ts of feature "{{ to.element.captured.feature }}".',
};

/** Routes and shells compose the features through their public index.ts. */
const WEB_COMPOSITION = {
  from: { element: { types: { anyOf: ['web-app', 'web-layout', 'web-root'] } } },
  disallow: { to: { element: { type: 'web-feature', fileInternalPath: '!index.ts' } } },
  message: 'Routes and shells import a feature through its public index.ts only.',
};

/** lib/, config/, i18n/ and styles/ are infrastructure: no feature, no component. */
const WEB_INFRASTRUCTURE = {
  from: { element: { types: { anyOf: ['web-lib', 'web-config', 'web-i18n', 'web-styles'] } } },
  disallow: {
    to: {
      element: {
        types: {
          anyOf: ['web-feature', 'web-layout', 'web-ui', 'web-motion', 'web-brand', 'web-app'],
        },
      },
    },
  },
  message:
    'lib/, config/, i18n/ and styles/ are infrastructure: they never import a component or a feature.',
};

/**
 * Architecture rules of apps/web (docs/architecture/frontend.md), checked like those of the
 * server and proved on deliberate violations by apps/web/test/architecture/eslint.spec.ts.
 *
 * @param {{ rootDir: string }} options
 */
export function webBoundaries({ rootDir }) {
  return [
    {
      files: ['src/**/*.{ts,tsx}'],
      plugins: { boundaries },
      settings: {
        'boundaries/root-path': rootDir,
        'boundaries/include': ['src/**/*.{ts,tsx}'],
        'boundaries/elements': [
          { type: 'web-ui', pattern: 'src/components/ui', partialMatch: false },
          { type: 'web-motion', pattern: 'src/components/motion', partialMatch: false },
          { type: 'web-brand', pattern: 'src/components/brand', partialMatch: false },
          { type: 'web-layout', pattern: 'src/components/layout', partialMatch: false },
          {
            type: 'web-feature',
            pattern: 'src/features/*',
            capture: ['feature'],
            partialMatch: false,
          },
          { type: 'web-app', pattern: 'src/app', partialMatch: false },
          { type: 'web-lib', pattern: 'src/lib', partialMatch: false },
          { type: 'web-config', pattern: 'src/config', partialMatch: false },
          { type: 'web-i18n', pattern: 'src/i18n', partialMatch: false },
          { type: 'web-styles', pattern: 'src/styles', partialMatch: false },
          { type: 'web-root', pattern: 'src', partialMatch: false },
        ],
        'import/resolver': {
          typescript: { alwaysTryTypes: true, project: join(rootDir, 'tsconfig.json') },
        },
      },
      rules: {
        'boundaries/dependencies': [
          'error',
          {
            default: 'allow',
            checkAllOrigins: true,
            policies: [
              WEB_DESIGN_SYSTEM,
              WEB_FEATURE_PUBLIC_API,
              WEB_COMPOSITION,
              WEB_INFRASTRUCTURE,
            ],
          },
        ],
      },
    },
  ];
}
