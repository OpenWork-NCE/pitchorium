import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { MediaContentType, MediaRejectionReason } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ObjectStorage, ObjectTooLargeError } from '../../../platform/storage';
import {
  checkContent,
  checkImageDimensions,
  checkPdfPages,
  fileKeys,
  kindOf,
  type MediaAssetRecord,
  type MediaFiles,
  storageKeys,
  type StoredVariant,
} from '../domain/media-asset';
import { MediaReady, MediaRejected } from '../domain/media-events';
import { PDF_THUMBNAIL, ruleOf, type UsageRule } from '../domain/usages';
import { MediaEventsRecorder } from './media-events.recorder';
import {
  ContentTypeDetector,
  ImageProcessor,
  ImportRefusedError,
  MalwareScanner,
  MediaRepository,
  PdfInspector,
  type ProcessedContent,
  type RenderedImage,
  RemoteImageFetcher,
} from './ports';

/** Public files never change under a key (the key holds a content digest). */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

const digest = (content: Buffer) => createHash('sha256').update(content).digest('hex');

type Outcome =
  { kind: 'ready'; content: ProcessedContent } | { kind: 'rejected'; reason: MediaRejectionReason };

const reject = (reason: MediaRejectionReason): Outcome => ({ kind: 'rejected', reason });

/**
 * Processing of an uploaded or imported file (worker, idempotent). Storage, antivirus and
 * provider calls happen outside any transaction; the result and its event are written in one
 * short transaction (ADR 0019, ADR 0022).
 */
@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name);

  constructor(
    private readonly assets: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly detector: ContentTypeDetector,
    private readonly scanner: MalwareScanner,
    private readonly images: ImageProcessor,
    private readonly pdfs: PdfInspector,
    private readonly fetcher: RemoteImageFetcher,
    private readonly events: MediaEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /**
   * Processes the asset when it awaits processing; replays and already settled assets only
   * remove a leftover quarantine copy. `lastAttempt` turns an unexpected failure into a
   * rejection instead of a retry.
   */
  async process(mediaId: string, lastAttempt: boolean): Promise<void> {
    const asset = await this.assets.findById(mediaId);
    if (!asset) return;
    const awaiting =
      asset.status === 'processing' || (asset.status === 'pending' && asset.source === 'import');
    if (!awaiting) {
      if (asset.status !== 'pending') await this.dropQuarantine(asset);
      return;
    }
    let outcome: Outcome;
    try {
      outcome = await this.examine(asset);
    } catch (error) {
      if (!lastAttempt) throw error;
      this.logger.error(error, `Processing of media ${mediaId} failed on its last attempt`);
      outcome = reject(asset.source === 'import' ? 'import_failed' : 'processing_failed');
    }
    await this.settle(asset, outcome);
    await this.dropQuarantine(asset);
  }

  private async examine(asset: MediaAssetRecord): Promise<Outcome> {
    const rule = ruleOf(asset.usage);
    if (asset.source === 'import') {
      const imported = await this.importOriginal(asset, rule);
      if (imported) return imported;
    }
    let content: Buffer | null;
    try {
      content = await this.storage.getObject('private', asset.quarantineKey, rule.maxBytes);
    } catch (error) {
      if (error instanceof ObjectTooLargeError) return reject('size_exceeded');
      throw error;
    }
    if (!content) return reject('upload_missing');

    // The antivirus sees every file, whatever its type: an infected file is reported as such.
    const scan = await this.scanner.scan(content);
    if (!scan.clean) {
      this.logger.warn(`Media ${asset.id} rejected: malware ${scan.signature}`);
      return reject('malware_detected');
    }

    const detected = await this.detector.detect(content);
    const declared =
      asset.source === 'upload'
        ? { contentType: asset.declaredContentType, size: asset.declaredSize }
        : null;
    const contentIssue = checkContent(rule, declared, detected, content.length);
    if (contentIssue || !detected) return reject(contentIssue ?? 'type_not_allowed');

    const contentType = detected as MediaContentType;
    const sha256 = digest(content);
    const base = { contentType, size: content.length, sha256 };
    if (kindOf(contentType) === 'pdf') return this.processPdf(asset, rule, content, base);
    return this.processImage(asset, rule, content, base);
  }

  /** Downloads a provider photo into quarantine; returns a rejection when it is refused. */
  private async importOriginal(asset: MediaAssetRecord, rule: UsageRule): Promise<Outcome | null> {
    if (!asset.importUrl) return reject('import_failed');
    let content: Buffer;
    try {
      content = await this.fetcher.fetch(asset.importUrl, rule.maxBytes);
    } catch (error) {
      if (error instanceof ImportRefusedError) {
        this.logger.warn(`Import of media ${asset.id} refused: ${error.message}`);
        return reject('import_failed');
      }
      throw error;
    }
    await this.storage.putObject({
      visibility: 'private',
      key: asset.quarantineKey,
      body: content,
      contentType: 'application/octet-stream',
    });
    return null;
  }

  private async processImage(
    asset: MediaAssetRecord,
    rule: UsageRule,
    content: Buffer,
    base: Pick<ProcessedContent, 'contentType' | 'size' | 'sha256'>,
  ): Promise<Outcome> {
    const size = await this.images.inspect(content);
    if (!size) return reject('image_unreadable');
    const dimensionIssue = checkImageDimensions(rule, size.width, size.height);
    if (dimensionIssue || !rule.image) return reject(dimensionIssue ?? 'type_not_allowed');
    const rendered = await this.images.render(content, rule.image.variants);
    return {
      kind: 'ready',
      content: {
        ...base,
        width: size.width,
        height: size.height,
        pageCount: null,
        files: { fileKey: null, variants: await this.storeVariants(asset, rendered) },
      },
    };
  }

  private async processPdf(
    asset: MediaAssetRecord,
    rule: UsageRule,
    content: Buffer,
    base: Pick<ProcessedContent, 'contentType' | 'size' | 'sha256'>,
  ): Promise<Outcome> {
    const pdf = await this.pdfs.inspect(content, PDF_THUMBNAIL.width);
    if (!pdf) return reject('pdf_unreadable');
    const pagesIssue = checkPdfPages(rule, pdf.pageCount);
    if (pagesIssue) return reject(pagesIssue);
    const thumbnail = await this.images.render(pdf.firstPage, [PDF_THUMBNAIL]);
    const fileKey = storageKeys.file(asset.id, base.sha256);
    await this.storage.putObject({
      visibility: asset.visibility,
      key: fileKey,
      body: content,
      contentType: base.contentType,
      cacheControl: this.cacheControl(asset),
    });
    const files: MediaFiles = { fileKey, variants: await this.storeVariants(asset, thumbnail) };
    return {
      kind: 'ready',
      content: { ...base, width: null, height: null, pageCount: pdf.pageCount, files },
    };
  }

  private async storeVariants(
    asset: MediaAssetRecord,
    rendered: readonly RenderedImage[],
  ): Promise<Record<string, StoredVariant>> {
    const variants: Record<string, StoredVariant> = {};
    for (const image of rendered) {
      const webpKey = storageKeys.variant(asset.id, image.name, digest(image.webp), 'webp');
      const avifKey = storageKeys.variant(asset.id, image.name, digest(image.avif), 'avif');
      await this.storage.putObject({
        visibility: asset.visibility,
        key: webpKey,
        body: image.webp,
        contentType: 'image/webp',
        cacheControl: this.cacheControl(asset),
      });
      await this.storage.putObject({
        visibility: asset.visibility,
        key: avifKey,
        body: image.avif,
        contentType: 'image/avif',
        cacheControl: this.cacheControl(asset),
      });
      variants[image.name] = { width: image.width, height: image.height, webpKey, avifKey };
    }
    return variants;
  }

  private cacheControl(asset: MediaAssetRecord): string {
    return asset.visibility === 'public' ? IMMUTABLE_CACHE : 'private, no-store';
  }

  /** Writes the result and its event; files of an asset deleted meanwhile are removed. */
  private async settle(asset: MediaAssetRecord, outcome: Outcome): Promise<void> {
    const from = asset.source === 'import' ? (['pending'] as const) : (['processing'] as const);
    const now = this.clock.now();
    const written = await this.transactions.run(async () => {
      const payload = { usage: asset.usage, source: asset.source, ownerId: asset.ownerId };
      if (outcome.kind === 'ready') {
        const { content } = outcome;
        const done = await this.assets.update(
          asset.id,
          { status: 'ready', ...content, processedAt: now },
          now,
          from,
        );
        if (done) await this.events.record(MediaReady, asset.id, payload);
        return done;
      }
      const done = await this.assets.update(
        asset.id,
        { status: 'rejected', rejectionReason: outcome.reason, processedAt: now },
        now,
        from,
      );
      if (done)
        await this.events.record(MediaRejected, asset.id, { ...payload, reason: outcome.reason });
      return done;
    });
    if (!written && outcome.kind === 'ready') await this.removeFiles(asset, outcome.content.files);
  }

  private async removeFiles(asset: MediaAssetRecord, files: MediaFiles): Promise<void> {
    await this.storage.deleteObjects(asset.visibility, fileKeys(files));
  }

  private async dropQuarantine(asset: MediaAssetRecord): Promise<void> {
    await this.storage.deleteObjects('private', [asset.quarantineKey]);
  }
}
