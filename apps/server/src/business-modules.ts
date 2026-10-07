import type { Type } from '@nestjs/common';
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

/** Business modules, registered in both the api and the worker. */
export const BUSINESS_MODULES: Type[] = [
  IdentityModule,
  AccessModule,
  ProfilesModule,
  OrganizationsModule,
  MediaModule,
  NetworkModule,
  ContentModule,
  ProjectsModule,
  ImpactModule,
  PaymentsModule,
  EngagementModule,
  MessagingModule,
  NotificationsModule,
  DiscoveryModule,
  EventsModule,
  MissionsModule,
  TrustModule,
  PrivacyModule,
  LocalizationModule,
  AdminModule,
];
