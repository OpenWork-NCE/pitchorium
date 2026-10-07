import { defineConfig } from 'orval';

export default defineConfig({
  pitchorium: {
    input: { target: '../../apps/server/openapi/openapi.json' },
    output: {
      mode: 'split',
      target: 'src/generated/api.ts',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      formatter: 'prettier',
      override: {
        mutator: { path: 'src/http/fetcher.ts', name: 'apiFetch' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
