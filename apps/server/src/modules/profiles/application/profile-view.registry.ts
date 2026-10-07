import { Injectable, Logger } from '@nestjs/common';
import type { ProfileView, ProfileViewListener } from './ports';

/** Holds the profile view listener registered by the network module. */
@Injectable()
export class ProfileViewRegistry {
  private readonly logger = new Logger(ProfileViewRegistry.name);
  private listener: ProfileViewListener | undefined;

  register(listener: ProfileViewListener): void {
    if (this.listener) throw new Error('A profile view listener is already registered');
    this.listener = listener;
  }

  /** Never throws and never waits: a lost view is tolerated, a slower read is not. */
  notify(view: ProfileView): void {
    try {
      this.listener?.profileViewed(view);
    } catch (error) {
      this.logger.warn(`Profile view not recorded: ${String(error)}`);
    }
  }
}
