import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { CommonConfig } from '../config';
import type { Clock } from '../kernel';
import {
  type BucketVisibility,
  ObjectStorage,
  type PresignedDownloadRequest,
  type PresignedUploadRequest,
  type PresignedUrl,
} from './object-storage';

const DEFAULT_EXPIRY_SECONDS = 900;

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
    });
  }

  async createUploadUrl(request: PresignedUploadRequest): Promise<PresignedUrl> {
    const expiresIn = request.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;
    const command = new PutObjectCommand({
      Bucket: this.bucket(request.visibility),
      Key: request.key,
      ContentType: request.contentType,
    });
    return {
      url: await getSignedUrl(this.client, command, { expiresIn }),
      method: 'PUT',
      expiresAt: this.expiresAt(expiresIn),
      headers: { 'Content-Type': request.contentType },
    };
  }

  async createDownloadUrl(request: PresignedDownloadRequest): Promise<PresignedUrl> {
    const expiresIn = request.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;
    const command = new GetObjectCommand({
      Bucket: this.bucket(request.visibility),
      Key: request.key,
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
