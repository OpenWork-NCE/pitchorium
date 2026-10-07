import type { Provider, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { setupApiApp } from '../../../src/api-app';
import { AppModule } from '../../../src/app.module';
import { parseApiConfig } from '../../../src/platform/config';
import { ObjectStorage } from '../../../src/platform/storage';
import { useTestEnvironment } from './environment';
import { FakeObjectStorage } from './fake-object-storage';

export interface ApiTestApp {
  app: NestExpressApplication;
  storage: FakeObjectStorage;
}

/**
 * The real AppModule, HTTP and Socket.IO setup. Storage is an in-memory fake, or MinIO with
 * `{ storage: 'minio' }`.
 */
export async function createApiTestApp(
  controllers: Type[] = [],
  environment: Record<string, string> = {},
  options: { storage?: 'fake' | 'minio'; providers?: Provider[] } = {},
): Promise<ApiTestApp> {
  useTestEnvironment(environment);
  const storage = new FakeObjectStorage();
  const builder = Test.createTestingModule({
    imports: [AppModule],
    controllers,
    providers: options.providers ?? [],
  });
  if (options.storage !== 'minio') builder.overrideProvider(ObjectStorage).useValue(storage);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  setupApiApp(app, parseApiConfig(process.env));
  await app.init();
  return { app, storage };
}
