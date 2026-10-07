import { Injectable } from '@nestjs/common';
import type { Preferences, UpdatePreferencesRequest } from '@pitchorium/contracts';
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

  async update(userId: string, request: UpdatePreferencesRequest): Promise<Preferences> {
    if (!(await this.locales.isActive(request.locale))) {
      throw new DomainError('IDENTITY_LOCALE_NOT_ACTIVE', 'Locale is not active');
    }
    const user = await this.users.findById(userId);
    if (!user) throw new DomainError('IDENTITY_USER_NOT_FOUND', 'User not found');
    const preferences = { locale: request.locale, timeZone: request.timeZone ?? user.timeZone };
    await this.users.updatePreferences(userId, preferences, this.clock.now());
    return preferences;
  }
}
