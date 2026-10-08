import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TrustedOrigins } from '../../platform/http';
import { AccessFacade } from './application/access.facade';
import { AccessService } from './application/access.service';
import { AdminBootstrapService } from './application/admin-bootstrap.service';
import { AccountStatusProvider, KycStatusProvider, RoleRepository } from './application/ports';
import { PrerequisiteRegistry } from './application/prerequisite.registry';
import { RoleService } from './application/role.service';
import { RegisteredAccountStatusProvider } from './application/account-status.registry';
import { RegisteredKycStatusProvider } from './application/kyc-status.registry';
import { DrizzleRoleRepository } from './infrastructure/drizzle-role.repository';
import { SessionHandshakeGuard } from './infrastructure/session-handshake.guard';
import { AccessController } from './interface/access.controller';
import { AuthenticationGuard } from './interface/authentication.guard';

const SHARED_PROVIDERS: Provider[] = [
  { provide: RoleRepository, useClass: DrizzleRoleRepository },
  RegisteredKycStatusProvider,
  { provide: KycStatusProvider, useExisting: RegisteredKycStatusProvider },
  RegisteredAccountStatusProvider,
  { provide: AccountStatusProvider, useExisting: RegisteredAccountStatusProvider },
  PrerequisiteRegistry,
  AccessService,
  AccessFacade,
  RoleService,
  AdminBootstrapService,
];

/**
 * Authorization. Global so that every module can inject AccessFacade; imports still go through
 * index.ts (ESLint boundaries).
 */
@Module({})
export class AccessModule {
  static forApi(): DynamicModule {
    return {
      module: AccessModule,
      global: true,
      controllers: [AccessController],
      providers: [
        ...SHARED_PROVIDERS,
        TrustedOrigins,
        SessionHandshakeGuard,
        { provide: APP_GUARD, useClass: AuthenticationGuard },
      ],
      exports: [AccessFacade, SessionHandshakeGuard],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: AccessModule,
      global: true,
      providers: SHARED_PROVIDERS,
      exports: [AccessFacade, AdminBootstrapService],
    };
  }
}
