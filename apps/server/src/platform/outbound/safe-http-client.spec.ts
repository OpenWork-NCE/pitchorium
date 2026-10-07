import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isPublicAddress } from './address-policy';
import { OutboundRequestRefusedError, type Resolver, SafeHttpClient } from './safe-http-client';

describe('isPublicAddress', () => {
  it.each([
    ['93.184.215.14', true],
    ['2606:4700:4700::1111', true],
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.20.0.1', false],
    ['192.168.1.1', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['224.0.0.1', false],
    ['::1', false],
    ['::ffff:127.0.0.1', false],
    ['fd00::1', false],
    ['fe80::1', false],
    ['2001:db8::1', false],
    ['2002:7f00:1::', false],
    ['localhost', false],
  ])('%s is public: %s', (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });
});

describe('SafeHttpClient', () => {
  let server: Server;
  let origin: string;
  const options = {
    timeoutMs: 1000,
    maxBytes: 1000,
    maxRedirects: 2,
    accept: 'text/html',
    acceptContentType: (type: string) => type === 'text/html',
  };

  beforeAll(async () => {
    server = createServer((request, response) => {
      const port = (server.address() as AddressInfo).port;
      switch (request.url ?? '') {
        case '/page':
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end('<title>Ok</title>');
          return;
        case '/redirect':
          response.writeHead(302, { Location: '/page' });
          response.end();
          return;
        case '/to-private-ip':
          response.writeHead(302, { Location: `http://10.0.0.1:${port}/page` });
          response.end();
          return;
        case '/to-private-name':
          response.writeHead(301, { Location: `http://internal.test:${port}/page` });
          response.end();
          return;
        case '/loop':
          response.writeHead(302, { Location: '/loop' });
          response.end();
          return;
        case '/large':
          response.writeHead(200, { 'Content-Type': 'text/html' });
          response.end('x'.repeat(5000));
          return;
        case '/image':
          response.writeHead(200, { 'Content-Type': 'image/png' });
          response.end('png');
          return;
        default:
          // Never answers: the client must give up.
          return;
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://public.test:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  /** The test server is on loopback: here loopback plays the public address. */
  const names: Record<string, string[]> = {
    'public.test': ['127.0.0.1'],
    'internal.test': ['10.0.0.7'],
    'mixed.test': ['127.0.0.1', '192.168.0.10'],
  };
  const resolver: Resolver = (host) => Promise.resolve(names[host] ?? []);
  const client = (resolve: Resolver = resolver) =>
    new SafeHttpClient(
      resolve,
      (address) => address === '127.0.0.1',
      () => true,
    );

  const refusal = (work: Promise<unknown>) =>
    work.then(
      () => 'none',
      (error: unknown) => (error instanceof OutboundRequestRefusedError ? error.message : 'other'),
    );

  it('fetches a page through an allowed redirect', async () => {
    const result = await client().fetch(`${origin}/redirect`, options);
    expect(result).toMatchObject({ url: `${origin}/page`, contentType: 'text/html' });
    expect(result.body.toString()).toBe('<title>Ok</title>');
  });

  it('refuses other schemes, credentials and, by default, other ports', async () => {
    expect(await refusal(client().fetch('ftp://public.test/file', options))).toContain('Scheme');
    expect(await refusal(client().fetch('file:///etc/passwd', options))).toContain('Scheme');
    expect(await refusal(client().fetch(`http://user:secret@public.test/`, options))).toContain(
      'Credentials',
    );
    const strict = new SafeHttpClient(resolver, () => true);
    expect(await refusal(strict.fetch('http://public.test:6379/', options))).toContain('Port');
  });

  it('refuses a name resolving to a private address, even among public ones', async () => {
    expect(await refusal(client().fetch('http://internal.test/page', options))).toContain(
      'Address not allowed',
    );
    expect(await refusal(client().fetch('http://mixed.test/page', options))).toContain(
      'Address not allowed',
    );
    expect(await refusal(client().fetch('http://169.254.169.254/latest', options))).toContain(
      'Address not allowed',
    );
    expect(await refusal(client().fetch('http://[::1]/', options))).toContain(
      'Address not allowed',
    );
  });

  it('resists DNS rebinding: one resolution per hop, the connection uses the checked address', async () => {
    let calls = 0;
    const rebinding: Resolver = vi.fn(() => {
      calls += 1;
      // First answer passes the check; a second query would point inside the network.
      return Promise.resolve(calls === 1 ? ['127.0.0.1'] : ['10.0.0.7']);
    });
    const result = await client(rebinding).fetch(`${origin}/page`, options);
    expect(result.body.toString()).toBe('<title>Ok</title>');
    expect(rebinding).toHaveBeenCalledTimes(1);
  });

  it('checks every redirect target again', async () => {
    expect(await refusal(client().fetch(`${origin}/to-private-ip`, options))).toContain(
      'Address not allowed',
    );
    expect(await refusal(client().fetch(`${origin}/to-private-name`, options))).toContain(
      'Address not allowed',
    );
    expect(await refusal(client().fetch(`${origin}/loop`, options))).toContain('redirects');
  });

  it('enforces the size limit, the content type and the timeout', async () => {
    expect(await refusal(client().fetch(`${origin}/large`, options))).toContain('Larger');
    expect(await refusal(client().fetch(`${origin}/image`, options))).toContain('Content type');
    expect(await refusal(client().fetch(`${origin}/silent`, { ...options, timeoutMs: 100 }))).toBe(
      'Timed out',
    );
  });
});
