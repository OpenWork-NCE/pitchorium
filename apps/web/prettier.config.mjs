import shared from '@pitchorium/config/prettier';
import * as tailwind from 'prettier-plugin-tailwindcss';

/** Shared style of the repository, plus the order of the Tailwind classes. */
export default {
  ...shared,
  plugins: [tailwind],
  tailwindStylesheet: './src/styles/globals.css',
  tailwindFunctions: ['cn', 'cva'],
};
