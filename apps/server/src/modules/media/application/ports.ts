import type { MediaContentType, MediaUsage } from '@pitchorium/contracts';
import type {
  MediaAssetRecord,
  MediaFiles,
  MediaResourceRef,
  StorageUsage,
} from '../domain/media-asset';
import type { VariantSpec } from '../domain/usages';

export type MediaAssetPatch = Partial<
  Pick<
    MediaAssetRecord,
    | 'status'
    | 'visibility'
    | 'targetVisibility'
    | 'contentType'
    | 'size'
    | 'sha256'
    | 'width'
    | 'height'
    | 'pageCount'
    | 'files'
    | 'rejectionReason'
    | 'moderationStatus'
    | 'attachedTo'
    | 'unattachedSince'
    | 'deletedAt'
  >
> & { processedAt?: Date; attachedAt?: Date | null };

export abstract class MediaRepository {
  abstract insert(asset: MediaAssetRecord): Promise<void>;
  abstract findById(id: string): Promise<MediaAssetRecord | null>;
  abstract findByIds(ids: readonly string[]): Promise<MediaAssetRecord[]>;
  /** Transaction-scoped lock on a key (quota of an owner, files of a resource). */
  abstract lock(key: string): Promise<void>;
  /** Files and bytes of the owner's assets that are not deleted. */
  abstract usageOf(ownerId: string): Promise<StorageUsage>;
  /**
   * Applies the patch when the asset is in one of `fromStatuses` (all statuses when omitted);
   * false when nothing was updated.
   */
  abstract update(
    id: string,
    patch: MediaAssetPatch,
    now: Date,
    fromStatuses?: readonly MediaAssetRecord['status'][],
  ): Promise<boolean>;
  /** Assets attached to a resource, not deleted. */
  abstract attachedTo(resource: MediaResourceRef): Promise<MediaAssetRecord[]>;
  /** Attached assets of a usage on a resource, other than `exceptId`. */
  abstract countAttached(
    resource: MediaResourceRef,
    usage: MediaUsage,
    exceptId: string,
  ): Promise<number>;
  /** Not attached since before `cutoff` and not deleted. */
  abstract orphanIds(cutoff: Date, limit: number): Promise<string[]>;
  /** Deleted assets whose files are not purged yet. */
  abstract unpurged(limit: number): Promise<MediaAssetRecord[]>;
  abstract markPurged(id: string, now: Date): Promise<void>;
}

export type ScanResult = { clean: true } | { clean: false; signature: string };

/** Port: antivirus. ClamAV in every environment; tests may use a signature-only fake. */
export abstract class MalwareScanner {
  /** Throws when the scanner cannot answer: the job is retried. */
  abstract scan(content: Buffer): Promise<ScanResult>;
}

/** Port: real type of a content, read from its magic bytes. */
export abstract class ContentTypeDetector {
  abstract detect(content: Buffer): Promise<string | null>;
}

export interface RenderedImage {
  name: string;
  width: number;
  height: number;
  webp: Buffer;
  avif: Buffer;
}

/** Port: image decoding and renditions, without metadata (EXIF, GPS) and upright. */
export abstract class ImageProcessor {
  /** Dimensions once upright, null when the image cannot be decoded. */
  abstract inspect(content: Buffer): Promise<{ width: number; height: number } | null>;
  abstract render(content: Buffer, variants: readonly VariantSpec[]): Promise<RenderedImage[]>;
}

/** Port: PDF structure check, page count and first page rendering (PNG). */
export abstract class PdfInspector {
  /** Null when the document cannot be parsed or rendered. */
  abstract inspect(
    content: Buffer,
    thumbnailWidth: number,
  ): Promise<{ pageCount: number; firstPage: Buffer } | null>;
}

export class ImportRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportRefusedError';
  }
}

/**
 * Port: download of an image to import: an OAuth provider photo (closed list of hosts) or the
 * image of a link preview (any public host, SSRF protections), with a timeout and a size limit.
 */
export abstract class RemoteImageFetcher {
  /** Throws ImportRefusedError for a refused URL or answer; other errors may be retried. */
  abstract fetch(url: string, maxBytes: number, usage: MediaUsage): Promise<Buffer>;
}

/** Port: per-member limit of upload requests. */
export abstract class UploadRateLimiter {
  /** False when the member exceeded the limit of the current window. */
  abstract consume(ownerId: string): Promise<boolean>;
}

/**
 * Implemented by the module that owns a kind of resource, to tell whether a member may read a
 * private file attached to one of its resources (registered with MediaFacade).
 */
export interface MediaReadAuthorizer {
  readonly resourceTypes: readonly string[];
  canRead(viewerId: string, resource: MediaResourceRef): Promise<boolean>;
}

export interface ProcessedContent {
  contentType: MediaContentType;
  size: number;
  sha256: string;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  files: MediaFiles;
}
