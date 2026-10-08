/** Public facade of the events module: the only file other modules may import. */
export {
  type EventDiscoverySource,
  EventsFacade,
  type EventSummary,
} from './application/events.facade';
export {
  EventCanceled,
  EventCompleted,
  EventCreated,
  EventPublished,
  EventUpdated,
  RegistrationCanceled,
  RegistrationCreated,
  RegistrationPromoted,
} from './domain/event-events';
export { EventsModule } from './events.module';
