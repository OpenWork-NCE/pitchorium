import { createConfig } from '@pitchorium/config/eslint';

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['src/generated/**'],
});
