import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxService } from '../../src/platform/inbox';
import { truncatePlatformTables } from './support/database';
import { createWorkerTestingModule } from './support/worker-testing-module';

describe('inbox', () => {
  let moduleRef: TestingModule;
  let inbox: InboxService;

  beforeAll(async () => {
    moduleRef = await createWorkerTestingModule();
    inbox = moduleRef.get(InboxService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await truncatePlatformTables();
  });

  it('processes a message once and reports redeliveries as duplicates', async () => {
    const work = vi.fn(() => Promise.resolve('done'));

    expect(await inbox.process('stripe', 'evt_1', work)).toEqual({
      status: 'processed',
      result: 'done',
    });
    expect(await inbox.process('stripe', 'evt_1', work)).toEqual({ status: 'duplicate' });
    expect(await inbox.process('flutterwave', 'evt_1', work)).toMatchObject({
      status: 'processed',
    });
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('does not record a message whose processing failed, so a redelivery retries it', async () => {
    await expect(
      inbox.process('stripe', 'evt_2', () => Promise.reject(new Error('handler failed'))),
    ).rejects.toThrow('handler failed');

    expect(await inbox.process('stripe', 'evt_2', () => Promise.resolve(1))).toEqual({
      status: 'processed',
      result: 1,
    });
  });

  it('processes concurrent deliveries of the same message only once', async () => {
    const work = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('ok'), 200)));

    const results = await Promise.all([
      inbox.process('stripe', 'evt_3', work),
      inbox.process('stripe', 'evt_3', work),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['duplicate', 'processed']);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
