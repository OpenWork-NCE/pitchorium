import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { COMMON_CONFIG, type CommonConfig } from '../config';
import { REDIS } from '../redis';

export interface FailedJobView {
  queue: string;
  id: string;
  name: string;
  attemptsMade: number;
  failedReason: string | null;
  failedAt: Date | null;
}

export type RetryOutcome = 'retried' | 'not_failed' | 'missing';

/**
 * Dead letters: a job is failed for good once its attempts are exhausted (DEFAULT_JOB_OPTIONS),
 * kept 7 days. Every queue of the deployment is found in Redis (`<prefix>:<queue>:meta`), so
 * that a module adding a queue needs nothing more; usable from the api, which runs no worker.
 */
@Injectable()
export class FailedJobsService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  async queueNames(): Promise<string[]> {
    const prefix = `${this.config.queue.prefix}:`;
    const names = new Set<string>();
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*:meta`, 'COUNT', 500);
      cursor = next;
      for (const key of keys) names.add(key.slice(prefix.length, -':meta'.length));
    } while (cursor !== '0');
    return [...names].sort();
  }

  async failed(queueName: string | undefined, limit: number): Promise<FailedJobView[]> {
    const names = queueName ? [queueName] : await this.queueNames();
    const jobs: FailedJobView[] = [];
    for (const name of names) {
      for (const job of await this.queue(name).getFailed(0, limit - 1)) {
        jobs.push({
          queue: name,
          id: job.id ?? '',
          name: job.name,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason || null,
          failedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        });
      }
    }
    return jobs
      .sort((a, b) => (b.failedAt?.getTime() ?? 0) - (a.failedAt?.getTime() ?? 0))
      .slice(0, limit);
  }

  async failedCount(): Promise<number> {
    let total = 0;
    for (const name of await this.queueNames()) total += await this.queue(name).getFailedCount();
    return total;
  }

  /** Jobs waiting (including delayed) and failed for good, per queue: the depth gauges. */
  async depths(): Promise<{ queue: string; waiting: number; failed: number }[]> {
    const depths = [];
    for (const name of await this.queueNames()) {
      const counts = await this.queue(name).getJobCounts('waiting', 'delayed', 'failed');
      depths.push({
        queue: name,
        waiting: (counts.waiting ?? 0) + (counts.delayed ?? 0),
        failed: counts.failed ?? 0,
      });
    }
    return depths;
  }

  /** Idempotent: a job no longer failed (retried meanwhile) is left as it is. */
  async retry(queueName: string, jobId: string): Promise<RetryOutcome> {
    const job = await this.queue(queueName).getJob(jobId);
    if (!job) return 'missing';
    if (!(await job.isFailed())) return 'not_failed';
    await job.retry('failed');
    return 'retried';
  }

  private queue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: { url: this.config.redis.url, maxRetriesPerRequest: null },
        prefix: this.config.queue.prefix,
      });
      this.queues.set(name, queue);
    }
    return queue;
  }
}
