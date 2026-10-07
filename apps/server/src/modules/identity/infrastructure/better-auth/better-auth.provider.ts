import type { Provider } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { API_CONFIG, type ApiConfig } from '../../../../platform/config';
import { TransactionManager } from '../../../../platform/database';
import { IdGenerator } from '../../../../platform/kernel';
import { Metrics } from '../../../../platform/observability';
import { REDIS } from '../../../../platform/redis';
import { ActiveLocalesService } from '../../application/active-locales.service';
import { IdentityEventsRecorder } from '../../application/identity-events.recorder';
import { IdentityUserRepository } from '../../application/identity-user.repository';
import { IdentityMailer } from '../identity-mailer';
import { AuthRequestScope } from './auth-request-scope';
import { type BetterAuthInstance, createBetterAuth } from './better-auth.factory';

export const BETTER_AUTH = Symbol('BETTER_AUTH');

export const betterAuthProvider: Provider<BetterAuthInstance> = {
  provide: BETTER_AUTH,
  inject: [
    API_CONFIG,
    TransactionManager,
    REDIS,
    IdGenerator,
    AuthRequestScope,
    IdentityUserRepository,
    IdentityEventsRecorder,
    IdentityMailer,
    ActiveLocalesService,
    Metrics,
  ],
  useFactory: (
    config: ApiConfig,
    transactions: TransactionManager,
    redis: Redis,
    ids: IdGenerator,
    scope: AuthRequestScope,
    users: IdentityUserRepository,
    events: IdentityEventsRecorder,
    mailer: IdentityMailer,
    locales: ActiveLocalesService,
    metrics: Metrics,
  ) =>
    createBetterAuth({
      config,
      transactions,
      redis,
      ids,
      scope,
      users,
      events,
      mailer,
      locales,
      metrics,
    }),
};
