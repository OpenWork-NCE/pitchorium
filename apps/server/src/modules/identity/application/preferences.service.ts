import { Injectable } from '@nestjs/common';
import type { Preferences } from '@pitchorium/contracts';
import { Clock, DomainError } from '../../../platform/kernel';
import { ActiveLocalesService } from './active-locales.service';
import { IdentityUserRepository } from './identity-user.repository';

@Injectable()
export class PreferencesService {
  constructor(
    private readonly users: IdentityUserRepository,
    private readonly locales: ActiveLocalesService,
    private readonly clock: Clock,
  ) {}

  async update(userId: string, preferences: Preferences): Promise<Preferences> {
    if (!(await this.locales.isActive(preferences.locale))) {
      throw new DomainError('IDENTITY_LOCALE_NOT_ACTIVE', 'Locale is not active');
    }
    await this.users.updateLocale(userId, preferences.locale, this.clock.now());
    return preferences;
  }
}
