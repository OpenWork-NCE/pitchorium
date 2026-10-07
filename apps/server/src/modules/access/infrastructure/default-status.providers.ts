import { Injectable } from '@nestjs/common';
import { AccountStatusProvider } from '../application/ports';

/** Until the trust module implements moderation, no account is suspended. */
@Injectable()
export class ActiveAccountStatusProvider extends AccountStatusProvider {
  isSuspended(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
