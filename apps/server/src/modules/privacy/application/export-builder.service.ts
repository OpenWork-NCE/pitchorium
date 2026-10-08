import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { Metrics } from '../../../platform/observability';
import { ObjectStorage } from '../../../platform/storage';
import { ExportReady } from '../domain/privacy-events';
import { type ArchiveEntry, ArchiveWriter } from './archive-writer';
import { type ExportedFile, PersonalDataRegistry } from './personal-data';
import { PrivacyEventsRecorder } from './privacy-events.recorder';
import { PrivacyRepository } from './ports';

/** A file of the member larger than this is listed in the archive, not copied. */
export const EXPORTED_FILE_MAX_BYTES = 200 * 1024 * 1024;

/** Amounts in minor units are bigints: written as strings, as in the API. */
const json = (value: unknown): Buffer =>
  Buffer.from(
    `${JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? item.toString() : item), 2)}\n`,
  );

/**
 * Builds the archive of an export in the worker (GDPR articles 15 and 20): `README.txt`, one
 * documented `<module>.json` per module, the files of the member under `files/`; stored in the
 * private bucket until it expires.
 */
@Injectable()
export class ExportBuilderService {
  private readonly logger = new Logger(ExportBuilderService.name);

  constructor(
    private readonly privacy: PrivacyRepository,
    private readonly registry: PersonalDataRegistry,
    private readonly archives: ArchiveWriter,
    private readonly storage: ObjectStorage,
    private readonly events: PrivacyEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly metrics: Metrics,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  /**
   * Builds the archive of a pending export. A failure leaves the export pending and throws, so
   * that the queue tries again after its backoff (a storage or a database that hiccups); only the
   * last attempt marks it failed, and the member may then ask again.
   */
  async build(
    exportId: string,
    { lastAttempt = true }: { lastAttempt?: boolean } = {},
  ): Promise<void> {
    const found = await this.privacy.findExport(exportId);
    if (!found || found.status !== 'pending' || !found.userId) return;
    const userId = found.userId;
    const key = `privacy/exports/${exportId}.zip`;
    let archive: { path: string; size: number } | null = null;
    try {
      archive = await this.archives.write(this.entries(userId));
      await this.storage.putFile({
        visibility: 'private',
        key,
        path: archive.path,
        size: archive.size,
        contentType: 'application/zip',
      });
    } catch (error) {
      this.logger.error(
        error,
        `Export ${exportId} failed${lastAttempt ? '' : ', to be tried again'}`,
      );
      if (lastAttempt) {
        await this.privacy.updateExport(exportId, {
          status: 'failed',
          error: 'build_failed',
          completedAt: this.clock.now(),
        });
        this.metrics.increment('pitchorium.privacy.export.failed');
      }
      throw error;
    } finally {
      if (archive) await rm(dirname(archive.path), { recursive: true, force: true });
    }
    await this.transactions.run(async () => {
      const now = this.clock.now();
      const expiresAt = new Date(now.getTime() + this.config.privacy.exportTtlMs);
      await this.privacy.updateExport(exportId, {
        status: 'ready',
        storageKey: key,
        sizeBytes: archive.size,
        completedAt: now,
        expiresAt,
      });
      await this.events.record(ExportReady, exportId, {
        userId,
        expiresAt: expiresAt.toISOString(),
      });
    });
    this.metrics.increment('pitchorium.privacy.export.ready');
  }

  /** Deletes the archives past their expiry (hourly). */
  async expire(): Promise<number> {
    const expired = await this.privacy.expiredExports(this.clock.now(), 100);
    for (const item of expired) {
      if (item.storageKey) await this.storage.deleteObjects('private', [item.storageKey]);
      await this.privacy.updateExport(item.id, { status: 'expired', storageKey: null });
    }
    return expired.length;
  }

  private async *entries(userId: string): AsyncGenerator<ArchiveEntry> {
    const exportedAt = this.clock.now().toISOString();
    const files: ExportedFile[] = [];
    const index: string[] = [];
    for (const registration of this.registry.all()) {
      const exported = await registration.exporter.export(userId);
      files.push(...(exported.files ?? []));
      index.push(`${registration.module}.json: ${registration.description}`);
      yield {
        name: `${registration.module}.json`,
        content: json({
          module: registration.module,
          description: registration.description,
          exportedAt,
          data: exported.data,
        }),
      };
    }
    const skipped: string[] = [];
    for (const file of files) {
      const content = await this.storage
        .getObject(file.visibility, file.key, EXPORTED_FILE_MAX_BYTES)
        .catch(() => null);
      if (content) yield { name: `files/${file.name}`, content };
      else skipped.push(file.name);
    }
    yield {
      name: 'README.txt',
      content: Buffer.from(
        [
          'Pitchorium - export of your personal data / export de vos données personnelles',
          `Exported at / exporté le: ${exportedAt} (UTC)`,
          '',
          'One JSON file per module / un fichier JSON par module:',
          ...index.map((line) => `- ${line}`),
          '',
          `Files / fichiers: ${files.length - skipped.length} in files/`,
          ...(skipped.length > 0
            ? [`Not copied (too large or unavailable): ${skipped.join(', ')}`]
            : []),
          '',
        ].join('\n'),
      ),
    };
  }
}
