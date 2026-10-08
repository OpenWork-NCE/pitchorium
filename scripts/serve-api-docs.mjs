#!/usr/bin/env node
// Serves the API reference (docs/api/index.html) and the OpenAPI document it reads, read only,
// on 127.0.0.1. Usage: pnpm docs:api [port], then open http://127.0.0.1:3300/.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.argv[2] ?? 3300);
const allowed = ['/docs/api/index.html', '/apps/server/openapi/openapi.json'];
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json' };

createServer((request, response) => {
  const path = (request.url ?? '/').split('?')[0];
  const file = path === '/' ? allowed[0] : normalize(path);
  const absolute = join(root, file);
  if (!allowed.includes(file) || !existsSync(absolute) || !statSync(absolute).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(file)] });
  createReadStream(absolute).pipe(response);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`API reference on http://127.0.0.1:${port}/\n`);
});
