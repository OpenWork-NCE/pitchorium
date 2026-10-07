import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { CommonConfig } from '../config';
import type { Clock } from '../kernel';
import {
  type BucketVisibility,
  ObjectStorage,
  ObjectTooLargeError,
  type PresignedDownloadRequest,
  type PresignedUploadRequest,
  type PresignedUrl,
  type PutObjectRequest,
  type StoredObject,
} from './object-storage';

const DEFAULT_EXPIRY_SECONDS = 900;
const DELETE_BATCH_SIZE = 1000;

const isMissing = (error: unknown) =>
  error instanceof NoSuchKey ||
  error instanceof NotFound ||
  (error instanceof Error && error.name === 'NotFound');

export class S3ObjectStorage extends ObjectStorage {
  private readonly client: S3Client;

  constructor(
    private readonly config: CommonConfig['storage'],
    private readonly clock: Clock,
  ) {
    super();
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Presigned uploads come from browsers, which do not compute S3 checksums; MinIO and R2
      // do not need them either.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async createUploadUrl(request: PresignedUploadRequest): Promise<PresignedUrl> {
    const expiresIn = request.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;
    const command = new PutObjectCommand({
      Bucket: this.bucket(request.visibility),
      Key: request.key,
      ContentType: request.contentType,
      ContentLength: request.contentLength,
    });
    const headers: Record<string, string> = { 'Content-Type': request.contentType };
    const signableHeaders = new Set(['content-type']);
    if (request.contentLength !== undefined) {
      headers['Content-Length'] = String(request.contentLength);
      signableHeaders.add('content-length');
    }
    return {
      url: await getSignedUrl(this.client, command, { expiresIn, signableHeaders }),
      method: 'PUT',
      expiresAt: this.expiresAt(expiresIn),
      headers,
    };
  }

  async createDownloadUrl(request: PresignedDownloadRequest): Promise<PresignedUrl> {
    const expiresIn = request.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;
    const command = new GetObjectCommand({
      Bucket: this.bucket(request.visibility),
      Key: request.key,
      ResponseContentDisposition: request.contentDisposition,
    });
    return {
      url: await getSignedUrl(this.client, command, { expiresIn }),
      method: 'GET',
      expiresAt: this.expiresAt(expiresIn),
      headers: {},
    };
  }

  publicUrl(key: string): string {
    return `${this.config.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async headObject(visibility: BucketVisibility, key: string): Promise<StoredObject | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket(visibility), Key: key }),
      );
      return { size: head.ContentLength ?? 0, contentType: head.ContentType };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async getObject(
    visibility: BucketVisibility,
    key: string,
    maxBytes: number,
  ): Promise<Buffer | null> {
    let body: AsyncIterable<Uint8Array> | undefined;
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket(visibility), Key: key }),
      );
      if ((response.ContentLength ?? 0) > maxBytes) {
        response.Body?.transformToWebStream()
          .cancel()
          .catch(() => undefined);
        throw new ObjectTooLargeError(maxBytes);
      }
      body = response.Body as AsyncIterable<Uint8Array> | undefined;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of body ?? []) {
      size += chunk.length;
      if (size > maxBytes) throw new ObjectTooLargeError(maxBytes);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async putObject(request: PutObjectRequest): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket(request.visibility),
        Key: request.key,
        Body: request.body,
        ContentType: request.contentType,
        CacheControl: request.cacheControl,
      }),
    );
  }

  async deleteObjects(visibility: BucketVisibility, keys: readonly string[]): Promise<void> {
    for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
      const batch = keys.slice(start, start + DELETE_BATCH_SIZE);
      const result = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket(visibility),
          Delete: { Objects: batch.map((key) => ({ Key: key })), Quiet: true },
        }),
      );
      const failed = (result.Errors ?? []).filter((error) => error.Code !== 'NoSuchKey');
      if (failed.length > 0) {
        throw new Error(`Failed to delete ${failed.length} objects: ${failed[0]?.Code ?? ''}`);
      }
    }
  }

  async checkHealth(): Promise<void> {
    await Promise.all(
      (['public', 'private'] as const).map((visibility) =>
        this.client.send(new HeadBucketCommand({ Bucket: this.bucket(visibility) })),
      ),
    );
  }

  close(): void {
    this.client.destroy();
  }

  private bucket(visibility: BucketVisibility): string {
    return this.config.buckets[visibility];
  }

  private expiresAt(seconds: number): Date {
    return new Date(this.clock.now().getTime() + seconds * 1000);
  }
}
