import { ObjectStorage, type PresignedUrl } from '../../../src/platform/storage';

export class FakeObjectStorage extends ObjectStorage {
  healthy = true;

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

  checkHealth(): Promise<void> {
    return this.healthy ? Promise.resolve() : Promise.reject(new Error('bucket unreachable'));
  }
}
