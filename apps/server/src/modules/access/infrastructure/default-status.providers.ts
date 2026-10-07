import { Injectable } from '@nestjs/common';
import { AccountStatusProvider, KycStatusProvider } from '../application/ports';

/** Until the payments module implements KYC, nobody is KYC-verified (fail closed). */
@Injectable()
export class UnverifiedKycStatusProvider extends KycStatusProvider {
  isVerified(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

/** Until the trust module implements moderation, no account is suspended. */
@Injectable()
export class ActiveAccountStatusProvider extends AccountStatusProvider {
  isSuspended(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
