export type BucketVisibility = 'public' | 'private';

export interface PresignedUploadRequest {
  visibility: BucketVisibility;
  key: string;
  contentType: string;
  /** Exact size in bytes, signed into the URL: an upload of another size is refused. */
  contentLength?: number;
  expiresInSeconds?: number;
}

export interface PresignedDownloadRequest {
  visibility: BucketVisibility;
  key: string;
  expiresInSeconds?: number;
  /** Content-Disposition sent with the object, for example `attachment; filename="pitch.pdf"`. */
  contentDisposition?: string;
}

export interface PresignedUrl {
  url: string;
  method: 'PUT' | 'GET';
  expiresAt: Date;
  headers: Record<string, string>;
}

export interface StoredObject {
  size: number;
  contentType: string | undefined;
}

export interface PutObjectRequest {
  visibility: BucketVisibility;
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

export class ObjectTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Object larger than ${maxBytes} bytes`);
    this.name = 'ObjectTooLargeError';
  }
}

/** Port for S3-compatible object storage (MinIO locally, Cloudflare R2 in production). */
export abstract class ObjectStorage {
  abstract createUploadUrl(request: PresignedUploadRequest): Promise<PresignedUrl>;
  abstract createDownloadUrl(request: PresignedDownloadRequest): Promise<PresignedUrl>;
  /** Stable URL of an object in the public bucket. */
  abstract publicUrl(key: string): string;
  /** Null when the object does not exist. */
  abstract headObject(visibility: BucketVisibility, key: string): Promise<StoredObject | null>;
  /**
   * Reads a whole object, null when it does not exist. Throws ObjectTooLargeError beyond
   * `maxBytes`, without reading the rest.
   */
  abstract getObject(
    visibility: BucketVisibility,
    key: string,
    maxBytes: number,
  ): Promise<Buffer | null>;
  abstract putObject(request: PutObjectRequest): Promise<void>;
  /** Deleting a missing object is not an error. */
  abstract deleteObjects(visibility: BucketVisibility, keys: readonly string[]): Promise<void>;
  /** Throws when a bucket is not reachable. */
  abstract checkHealth(): Promise<void>;
}
