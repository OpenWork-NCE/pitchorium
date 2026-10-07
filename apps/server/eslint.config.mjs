import { createConfig } from '@pitchorium/config/eslint';
import { serverBoundaries } from '@pitchorium/config/eslint-boundaries';

export default [
  ...createConfig({
    tsconfigRootDir: import.meta.dirname,
    decorators: true,
    ignores: ['openapi/**'],
  }),
  ...serverBoundaries({ rootDir: import.meta.dirname }),
];
