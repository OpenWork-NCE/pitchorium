import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'node:fs';
import type { CommonConfig } from '../config';
import type { Clock } from '../kernel';
import {
  type BucketVisibility,
  type CopyObjectRequest,
  ObjectStorage,
  ObjectTooLargeError,
  type PresignedDownloadRequest,
  type PutFileRequest,
  type PresignedUploadRequest,
  type PresignedUrl,
  type PutObjectRequest,
  type StoredObject,
} from './object-storage';

const DEFAULT_EXPIRY_SECONDS = 900;
/** Parallel single-object deletions (see deleteObjects). */
const DELETE_CONCURRENCY = 8;

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
    });
    const signingDate = request.signedAt ?? this.clock.now();
    return {
      url: await getSignedUrl(this.client, command, { expiresIn, signingDate }),
      method: 'GET',
      expiresAt: new Date(signingDate.getTime() + expiresIn * 1000),
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

  async putFile(request: PutFileRequest): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket(request.visibility),
        Key: request.key,
        Body: createReadStream(request.path),
        ContentLength: request.size,
        ContentType: request.contentType,
      }),
    );
  }

  /** CopyObject across buckets of the account, with replaced metadata (supported by R2). */
  async copyObject(request: CopyObjectRequest): Promise<void> {
    const source = `${this.bucket(request.from)}/${request.key}`;
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket(request.to),
        Key: request.key,
        CopySource: source.split('/').map(encodeURIComponent).join('/'),
        MetadataDirective: 'REPLACE',
        ContentType: request.contentType,
        CacheControl: request.cacheControl,
      }),
    );
  }

  /**
   * One DeleteObject per key rather than DeleteObjects: the SDK forces a CRC32 checksum header
   * on DeleteObjects, which R2 does not document as accepted; DeleteObject needs no checksum and
   * answers 204 for a missing key.
   */
  async deleteObjects(visibility: BucketVisibility, keys: readonly string[]): Promise<void> {
    const bucket = this.bucket(visibility);
    for (let start = 0; start < keys.length; start += DELETE_CONCURRENCY) {
      await Promise.all(
        keys
          .slice(start, start + DELETE_CONCURRENCY)
          .map((key) => this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))),
      );
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
