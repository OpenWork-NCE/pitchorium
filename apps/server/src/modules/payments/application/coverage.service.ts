import { Inject, Injectable } from '@nestjs/common';
import type { PaymentCoverage } from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { buildCoverage } from '../domain/coverage';
import { PaymentProviders } from './ports';

/**
 * Public coverage of the payments (section 9.2): what the enabled providers really serve, and the
 * commission in force (section 9.3), as configured for the quotes.
 */
@Injectable()
export class CoverageService {
  constructor(
    private readonly providers: PaymentProviders,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  coverage(): PaymentCoverage {
    return buildCoverage(this.providers.enabled(), this.config.payments.commission);
  }
}
