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
