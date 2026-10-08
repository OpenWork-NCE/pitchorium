import { describe, expect, it } from 'vitest';
import type { CommonConfig } from '../../../platform/config';
import type { TransactionManager } from '../../../platform/database';
import { FixedClock } from '../../../platform/kernel';
import type { Metrics } from '../../../platform/observability';
import type { ObjectStorage } from '../../../platform/storage';
import { ExportBuilderService } from './export-builder.service';
import type { PersonalDataRegistry } from './personal-data';
import type { PrivacyEventsRecorder } from './privacy-events.recorder';
import type { PrivacyRepository } from './ports';

/** An export whose archive cannot be written (a storage that hiccups). */
function failingExport() {
  const patches: Record<string, unknown>[] = [];
  const metrics: string[] = [];
  const service = new ExportBuilderService(
    {
      findExport: () => Promise.resolve({ id: 'export-1', userId: 'user-1', status: 'pending' }),
      updateExport: (_id: string, patch: Record<string, unknown>) => {
        patches.push(patch);
        return Promise.resolve();
      },
    } as unknown as PrivacyRepository,
    { all: () => [] } as unknown as PersonalDataRegistry,
    { write: () => Promise.reject(new Error('storage unavailable')) },
    {} as ObjectStorage,
    {} as PrivacyEventsRecorder,
    {} as TransactionManager,
    new FixedClock(new Date('2026-10-08T12:00:00Z')),
    { increment: (name: string) => metrics.push(name) } as unknown as Metrics,
    { privacy: { exportTtlMs: 1000 } } as CommonConfig,
  );
  return { service, patches, metrics };
}

describe('export builder', () => {
  it('leaves the export pending and throws while the queue may try again', async () => {
    const { service, patches, metrics } = failingExport();
    await expect(service.build('export-1', { lastAttempt: false })).rejects.toThrow(
      'storage unavailable',
    );
    expect(patches).toEqual([]);
    expect(metrics).toEqual([]);
  });

  it('marks the export failed at the last attempt only', async () => {
    const { service, patches, metrics } = failingExport();
    await expect(service.build('export-1', { lastAttempt: true })).rejects.toThrow();
    expect(patches).toEqual([expect.objectContaining({ status: 'failed', error: 'build_failed' })]);
    expect(metrics).toEqual(['pitchorium.privacy.export.failed']);
  });
});
