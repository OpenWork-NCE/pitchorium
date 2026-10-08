import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Metrics } from '../observability';
import { FailedJobsService } from '../queue';

export const QUEUE_WAITING_METRIC = 'pitchorium.queue.waiting';
export const QUEUE_FAILED_METRIC = 'pitchorium.queue.failed';
const MEASURE_EVERY_MS = 60_000;

/** Depth of every queue, measured by the worker each minute (alerts: slo-and-alerts.md). */
@Injectable()
export class QueueMetricsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QueueMetricsService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly jobs: FailedJobsService,
    private readonly metrics: Metrics,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.measure(), MEASURE_EVERY_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async measure(): Promise<void> {
    try {
      for (const { queue, waiting, failed } of await this.jobs.depths()) {
        this.metrics.gauge(QUEUE_WAITING_METRIC, waiting, { queue });
        this.metrics.gauge(QUEUE_FAILED_METRIC, failed, { queue });
      }
    } catch (error) {
      this.logger.warn(`Queue depths not measured: ${String(error)}`);
    }
  }
}
