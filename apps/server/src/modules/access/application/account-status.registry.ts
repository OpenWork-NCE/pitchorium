import { Injectable } from '@nestjs/common';
import { AccountStatusProvider, type AccountStatusSource } from './ports';

/** Delegates to the source registered by the trust module; without one, nobody is suspended. */
@Injectable()
export class RegisteredAccountStatusProvider extends AccountStatusProvider {
  private source: AccountStatusSource | undefined;

  register(source: AccountStatusSource): void {
    if (this.source) throw new Error('An account status source is already registered');
    this.source = source;
  }

  isSuspended(userId: string): Promise<boolean> {
    return this.source ? this.source.isSuspended(userId) : Promise.resolve(false);
  }
}
