import { Injectable } from '@nestjs/common';
import { type Dispatch, NotificationCreator } from './notification-creator';

/**
 * Public facade of the notifications module. Notifications come from the events of the other
 * modules; `notify` serves the development data (ADR 0035) and future direct sources.
 */
@Injectable()
export class NotificationsFacade {
  constructor(private readonly creator: NotificationCreator) {}

  /** Idempotent per (source, recipient); joins the caller's transaction. */
  notify(source: string, dispatch: Dispatch): Promise<number> {
    return this.creator.deliver(source, dispatch);
  }
}
