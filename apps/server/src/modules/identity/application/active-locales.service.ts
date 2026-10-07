import { Injectable } from '@nestjs/common';
import { DEFAULT_LOCALE, type Locale, LOCALES } from '@pitchorium/contracts';
import { FeatureFlagsService } from '../../../platform/feature-flags';

/** Locales whose `locale.<code>` feature flag is enabled. */
@Injectable()
export class ActiveLocalesService {
  constructor(private readonly flags: FeatureFlagsService) {}

  async list(): Promise<Locale[]> {
    const flags = await this.flags.all();
    const active = LOCALES.filter((locale) => flags.get(`locale.${locale}`) === true);
    // The source locale is the last resort, even if every flag is off.
    return active.length > 0 ? active : [DEFAULT_LOCALE];
  }

  async isActive(locale: Locale): Promise<boolean> {
    return (await this.list()).includes(locale);
  }
}
