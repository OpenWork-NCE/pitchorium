import { describe, expect, it } from 'vitest';
import type { AuditService } from '../../../platform/audit';
import type { CommonConfig } from '../../../platform/config';
import type { TransactionManager } from '../../../platform/database';
import { FixedClock, UuidV7Generator } from '../../../platform/kernel';
import type { ImpactEventsRecorder } from './impact-events.recorder';
import { MethodologiesService } from './methodologies.service';
import type { ImpactRepository } from './ports';

describe('demonstration methodology', () => {
  it('is refused in production, before anything is read or written', async () => {
    const untouched = new Proxy(
      {},
      {
        get: () => {
          throw new Error('Nothing may be read or written');
        },
      },
    );
    const service = new MethodologiesService(
      { env: 'production' } as CommonConfig,
      untouched as ImpactRepository,
      untouched as ImpactEventsRecorder,
      untouched as AuditService,
      untouched as TransactionManager,
      new UuidV7Generator(),
      new FixedClock(new Date()),
    );
    await expect(service.ensureDemo({ name: 'DEMO', criteria: [] })).rejects.toMatchObject({
      code: 'IMPACT_DEMO_REFUSED',
    });
  });
});
