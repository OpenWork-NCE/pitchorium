import type { DynamicModule, Type } from '@nestjs/common';
import { IdentityModule } from './modules/identity';
import { AccessModule } from './modules/access';
import { ProfilesModule } from './modules/profiles';
import { OrganizationsModule } from './modules/organizations';
import { MediaModule } from './modules/media';
import { NetworkModule } from './modules/network';
import { ContentModule } from './modules/content';
import { ProjectsModule } from './modules/projects';
import { ImpactModule } from './modules/impact';
import { PaymentsModule } from './modules/payments';
import { EngagementModule } from './modules/engagement';
import { MessagingModule } from './modules/messaging';
import { NotificationsModule } from './modules/notifications';
import { DiscoveryModule } from './modules/discovery';
import { EventsModule } from './modules/events';
import { MissionsModule } from './modules/missions';
import { TrustModule } from './modules/trust';
import { PrivacyModule } from './modules/privacy';
import { LocalizationModule } from './modules/localization';
import { AdminModule } from './modules/admin';

/** Modules wired the same way in both processes. */
const COMMON_MODULES: Type[] = [LocalizationModule, AdminModule];

/**
 * Business modules of each process. Modules with process-specific providers (the api serves
 * Better Auth, the worker sends emails, processes files and runs scheduled tasks) expose forApi() and forWorker().
 */
export const API_BUSINESS_MODULES: (Type | DynamicModule)[] = [
  PrivacyModule.forApi(),
  IdentityModule.forApi(),
  AccessModule.forApi(),
  ProfilesModule.forApi(),
  MediaModule.forApi(),
  OrganizationsModule.forApi(),
  NetworkModule.forApi(),
  ContentModule.forApi(),
  ImpactModule.forApi(),
  ProjectsModule.forApi(),
  PaymentsModule.forApi(),
  EngagementModule.forApi(),
  MessagingModule.forApi(),
  EventsModule.forApi(),
  MissionsModule.forApi(),
  DiscoveryModule.forApi(),
  NotificationsModule.forApi(),
  TrustModule.forApi(),
  ...COMMON_MODULES,
];

export const WORKER_BUSINESS_MODULES: (Type | DynamicModule)[] = [
  PrivacyModule.forWorker(),
  IdentityModule.forWorker(),
  AccessModule.forWorker(),
  ProfilesModule.forWorker(),
  MediaModule.forWorker(),
  OrganizationsModule.forWorker(),
  NetworkModule.forWorker(),
  ContentModule.forWorker(),
  ImpactModule.forWorker(),
  ProjectsModule.forWorker(),
  PaymentsModule.forWorker(),
  EngagementModule.forWorker(),
  MessagingModule.forWorker(),
  EventsModule.forWorker(),
  MissionsModule.forWorker(),
  DiscoveryModule.forWorker(),
  NotificationsModule.forWorker(),
  TrustModule.forWorker(),
  ...COMMON_MODULES,
];
