import { PROVIDER_ROUTES } from './fake-providers';

/**
 * Preload of the api and the worker during the journeys of the web app against the real api
 * (`node -r @swc-node/register -r ./test/oauth/reroute.ts dist/main.api.js`): the provider URLs
 * Better Auth calls from the server go to the fake providers (FAKE_OAUTH_URL), as in the
 * integration tests. Never loaded outside the tests.
 */
const target = process.env['FAKE_OAUTH_URL'];
if (!target) throw new Error('FAKE_OAUTH_URL is not set: the preload reroutes to it.');

const original = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : input.toString();
  const route = PROVIDER_ROUTES[url.split('?')[0] ?? ''];
  return original(route ? `${target}${route}` : input, init);
};
