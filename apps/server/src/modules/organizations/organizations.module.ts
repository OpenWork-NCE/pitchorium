import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { InvitationTokensService } from './application/invitation-tokens.service';
import { InvitationsService } from './application/invitations.service';
import { MembersService } from './application/members.service';
import { OrganizationEventsRecorder } from './application/organization-events.recorder';
import { OrganizationProjectsRegistry } from './application/organization-projects.registry';
import { OrganizationReadsService } from './application/organization-reads.service';
import { OrganizationsFacade } from './application/organizations.facade';
import { OrganizationsService } from './application/organizations.service';
import { OrganizationRepository } from './application/ports';
import { VerificationService } from './application/verification.service';
import { DrizzleOrganizationRepository } from './infrastructure/drizzle-organization.repository';
import { OrganizationMailer } from './infrastructure/organization-mailer';
import { InvitationsController } from './interface/invitations.controller';
import { MembersController } from './interface/members.controller';
import { OrganizationEmailsHandler } from './interface/organization-emails.handler';
import { OrganizationResolver } from './interface/organization.resolver';
import { OrganizationsController } from './interface/organizations.controller';
import { VerificationController } from './interface/verification.controller';

import { OrganizationsPersonalData } from './infrastructure/organizations-personal-data';

const SHARED_PROVIDERS: Provider[] = [
  OrganizationsPersonalData,
  { provide: OrganizationRepository, useClass: DrizzleOrganizationRepository },
  OrganizationEventsRecorder,
  OrganizationProjectsRegistry,
  OrganizationsFacade,
];

/**
 * Organization pages, members, invitations and verification (ADR 0025). Global so that the
 * projects and payments modules can inject OrganizationsFacade; imports go through index.ts.
 */
@Module({})
export class OrganizationsModule {
  static forApi(): DynamicModule {
    return {
      module: OrganizationsModule,
      global: true,
      controllers: [
        OrganizationsController,
        MembersController,
        InvitationsController,
        VerificationController,
      ],
      providers: [
        ...SHARED_PROVIDERS,
        OrganizationReadsService,
        OrganizationsService,
        MembersService,
        InvitationsService,
        VerificationService,
        OrganizationResolver,
      ],
      exports: [OrganizationsFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: OrganizationsModule,
      global: true,
      providers: [
        ...SHARED_PROVIDERS,
        InvitationTokensService,
        OrganizationMailer,
        OrganizationEmailsHandler,
      ],
      exports: [OrganizationsFacade],
    };
  }
}
