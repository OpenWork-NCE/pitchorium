export type BucketVisibility = 'public' | 'private';

export interface PresignedUploadRequest {
  visibility: BucketVisibility;
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedDownloadRequest {
  visibility: BucketVisibility;
  key: string;
  expiresInSeconds?: number;
}

export interface PresignedUrl {
  url: string;
  method: 'PUT' | 'GET';
  expiresAt: Date;
  headers: Record<string, string>;
}

/** Port for S3-compatible object storage (MinIO locally, Cloudflare R2 in production). */
export abstract class ObjectStorage {
  abstract createUploadUrl(request: PresignedUploadRequest): Promise<PresignedUrl>;
  abstract createDownloadUrl(request: PresignedDownloadRequest): Promise<PresignedUrl>;
  /** Stable URL of an object in the public bucket. */
  abstract publicUrl(key: string): string;
  /** Throws when a bucket is not reachable. */
  abstract checkHealth(): Promise<void>;
}
