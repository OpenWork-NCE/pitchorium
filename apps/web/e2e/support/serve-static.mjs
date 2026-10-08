// Serves a built directory (the static Storybook) for the review captures, on a free port only.
// Usage: node e2e/support/serve-static.mjs <directory> <port>
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { assertPortFree } from './ports.mjs';

const [directory = 'storybook-static', portText = '6106'] = process.argv.slice(2);
const port = Number(portText);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

try {
  await assertPortFree(port);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://static').pathname));
  let file = join(directory, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(normalize(directory)) || !existsSync(file)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, () => process.stdout.write(`static ${directory} on ${port}\n`));
