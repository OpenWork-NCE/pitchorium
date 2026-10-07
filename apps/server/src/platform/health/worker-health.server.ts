import { createServer, type Server } from 'node:http';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { WORKER_CONFIG, type WorkerConfig } from '../config';
import { HealthService } from './health.service';

/** Minimal HTTP probe for the worker, which has no HTTP application. */
@Injectable()
export class WorkerHealthServer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerHealthServer.name);
  private server: Server | undefined;

  constructor(
    private readonly health: HealthService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.server = createServer((request, response) => {
      const respond = (status: number, body: unknown) => {
        response
          .writeHead(status, { 'content-type': 'application/json' })
          .end(JSON.stringify(body));
      };
      if (request.method !== 'GET') {
        respond(405, { status: 'error' });
      } else if (request.url === '/health/live') {
        respond(200, this.health.live());
      } else if (request.url === '/health/ready') {
        void this.health
          .ready()
          .then((result) => respond(result.status === 'ok' ? 200 : 503, result));
      } else {
        respond(404, { status: 'error' });
      }
    });
    const port = this.config.worker.healthPort;
    await new Promise<void>((resolve) => this.server?.listen(port, resolve));
    this.logger.log(`Worker health probe listening on port ${port}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
  }
}
