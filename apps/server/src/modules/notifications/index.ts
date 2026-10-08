/** Public facade of the notifications module: the only file other modules may import. */
export type { Dispatch } from './application/notification-creator';
export { NotificationsFacade } from './application/notifications.facade';
export {
  EmailBounced,
  EmailComplained,
  EmailSent,
  NotificationBatchCreated,
} from './domain/notifications-events';
export { NotificationsModule } from './notifications.module';
