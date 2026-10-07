const businessModules = [
  'identity',
  'access',
  'profiles',
  'organizations',
  'media',
  'network',
  'content',
  'projects',
  'impact',
  'payments',
  'engagement',
  'messaging',
  'notifications',
  'discovery',
  'events',
  'missions',
  'trust',
  'privacy',
  'localization',
  'admin',
];

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore'],
    ],
    'scope-empty': [2, 'never'],
    'scope-enum': [
      2,
      'always',
      [
        'repo',
        'config',
        'infra',
        'db',
        'contracts',
        'api-client',
        'i18n',
        'emails',
        'platform',
        'server',
        'ci',
        'docs',
        ...businessModules,
      ],
    ],
  },
};
