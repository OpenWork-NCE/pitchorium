import { Injectable } from '@nestjs/common';
import type { PaymentCoverage } from '@pitchorium/contracts';
import { buildCoverage } from '../domain/coverage';
import { PaymentProviders } from './ports';

/** Public coverage of the payments (section 9.2): what the enabled providers really serve. */
@Injectable()
export class CoverageService {
  constructor(private readonly providers: PaymentProviders) {}

  coverage(): PaymentCoverage {
    return buildCoverage(this.providers.enabled());
  }
}
