import { readFile } from 'node:fs/promises';
import {
  type BucketVisibility,
  type CopyObjectRequest,
  ObjectStorage,
  ObjectTooLargeError,
  type PresignedUrl,
  type PutFileRequest,
  type PutObjectRequest,
  type StoredObject,
} from '../../../src/platform/storage';

/** In-memory storage for the tests that do not exercise S3 itself (media tests use MinIO). */
export class FakeObjectStorage extends ObjectStorage {
  healthy = true;
  private readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  createUploadUrl(): Promise<PresignedUrl> {
    return Promise.resolve({
      url: 'http://storage.invalid/upload',
      method: 'PUT',
      expiresAt: new Date(),
      headers: {},
    });
  }

  createDownloadUrl(): Promise<PresignedUrl> {
    return Promise.resolve({
      url: 'http://storage.invalid/download',
      method: 'GET',
      expiresAt: new Date(),
      headers: {},
    });
  }

  publicUrl(key: string): string {
    return `http://storage.invalid/${key}`;
  }

  headObject(visibility: BucketVisibility, key: string): Promise<StoredObject | null> {
    const object = this.objects.get(`${visibility}/${key}`);
    return Promise.resolve(
      object ? { size: object.body.length, contentType: object.contentType } : null,
    );
  }

  getObject(visibility: BucketVisibility, key: string, maxBytes: number): Promise<Buffer | null> {
    const object = this.objects.get(`${visibility}/${key}`);
    if (object && object.body.length > maxBytes) {
      return Promise.reject(new ObjectTooLargeError(maxBytes));
    }
    return Promise.resolve(object?.body ?? null);
  }

  putObject(request: PutObjectRequest): Promise<void> {
    this.objects.set(`${request.visibility}/${request.key}`, {
      body: request.body,
      contentType: request.contentType,
    });
    return Promise.resolve();
  }

  async putFile(request: PutFileRequest): Promise<void> {
    this.objects.set(`${request.visibility}/${request.key}`, {
      body: await readFile(request.path),
      contentType: request.contentType,
    });
  }

  copyObject(request: CopyObjectRequest): Promise<void> {
    const object = this.objects.get(`${request.from}/${request.key}`);
    if (!object) return Promise.reject(new Error(`No object ${request.key}`));
    this.objects.set(`${request.to}/${request.key}`, {
      body: object.body,
      contentType: request.contentType,
    });
    return Promise.resolve();
  }

  deleteObjects(visibility: BucketVisibility, keys: readonly string[]): Promise<void> {
    for (const key of keys) this.objects.delete(`${visibility}/${key}`);
    return Promise.resolve();
  }

  checkHealth(): Promise<void> {
    return this.healthy ? Promise.resolve() : Promise.reject(new Error('bucket unreachable'));
  }
}
