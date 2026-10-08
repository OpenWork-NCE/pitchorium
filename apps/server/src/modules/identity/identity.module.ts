import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { TrustedOrigins } from '../../platform/http';
import { ActiveLocalesService } from './application/active-locales.service';
import { IdentityEventsRecorder } from './application/identity-events.recorder';
import { IdentityUserRepository } from './application/identity-user.repository';
import { IdentityFacade } from './application/identity.facade';
import { LegalService } from './application/legal.service';
import { PreferencesService } from './application/preferences.service';
import { SessionAuthenticator } from './application/session-authenticator';
import { AuthHttpHandler } from './infrastructure/better-auth/auth-http.handler';
import { AuthRequestScope } from './infrastructure/better-auth/auth-request-scope';
import { BetterAuthSessionAuthenticator } from './infrastructure/better-auth/better-auth-session.authenticator';
import { betterAuthProvider } from './infrastructure/better-auth/better-auth.provider';
import { DrizzleIdentityUserRepository } from './infrastructure/drizzle-identity-user.repository';
import { IdentityMailer } from './infrastructure/identity-mailer';
import { AccountController } from './interface/account.controller';
import { SignInMethodEmailHandler } from './interface/sign-in-method-email.handler';

import { IdentityPersonalData } from './infrastructure/identity-personal-data';

const SHARED_PROVIDERS: Provider[] = [
  IdentityPersonalData,
  { provide: IdentityUserRepository, useClass: DrizzleIdentityUserRepository },
  ActiveLocalesService,
  IdentityEventsRecorder,
  IdentityFacade,
  IdentityMailer,
  LegalService,
];

/**
 * Accounts and authentication (Better Auth). The api serves /v1/auth; the worker sends emails.
 * Global so that other modules can inject IdentityFacade; imports go through index.ts.
 */
@Module({})
export class IdentityModule {
  static forApi(): DynamicModule {
    return {
      module: IdentityModule,
      global: true,
      controllers: [AccountController],
      providers: [
        ...SHARED_PROVIDERS,
        PreferencesService,
        TrustedOrigins,
        AuthRequestScope,
        betterAuthProvider,
        AuthHttpHandler,
        { provide: SessionAuthenticator, useClass: BetterAuthSessionAuthenticator },
      ],
      exports: [IdentityFacade, SessionAuthenticator],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: IdentityModule,
      global: true,
      providers: [...SHARED_PROVIDERS, SignInMethodEmailHandler],
      exports: [IdentityFacade],
    };
  }
}
