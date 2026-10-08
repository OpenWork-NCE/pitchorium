// Stand-in for the api during the end-to-end tests of the web app: the public routes the pages
// read, with the CORS headers of the real api. Anything else answers an RFC 9457 404.
import { createServer } from 'node:http';

const port = Number(process.env.STUB_API_PORT ?? 3299);
const origin = process.env.STUB_WEB_ORIGIN ?? 'http://localhost:3201';

const routes = {
  '/v1/locales': { status: 200, body: { defaultLocale: 'fr', locales: ['fr', 'en'] } },
  '/v1/health/ready': {
    status: 200,
    body: { status: 'ok', checks: { database: { status: 'up', latencyMs: 1 } } },
  },
};

createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://stub').pathname;
  const route = routes[path] ?? {
    status: 404,
    body: { type: 'about:blank', title: 'Not Found', status: 404, code: 'NOT_FOUND' },
  };
  response.writeHead(route.status, {
    'content-type': route.status === 200 ? 'application/json' : 'application/problem+json',
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
  });
  response.end(JSON.stringify(route.body));
}).listen(port, () => process.stdout.write(`stub api on ${port}\n`));
