import { Injectable } from '@nestjs/common';
import { KycStatusProvider, type KycStatusSource } from './ports';

/**
 * Delegates to the source registered by the payments module; without one, nobody is
 * KYC-verified (fail closed).
 */
@Injectable()
export class RegisteredKycStatusProvider extends KycStatusProvider {
  private source: KycStatusSource | undefined;

  register(source: KycStatusSource): void {
    if (this.source) throw new Error('A KYC status source is already registered');
    this.source = source;
  }

  isVerified(userId: string): Promise<boolean> {
    return this.source ? this.source.isVerified(userId) : Promise.resolve(false);
  }
}
