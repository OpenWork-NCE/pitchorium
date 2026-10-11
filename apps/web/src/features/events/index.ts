/**
 * Public facade of the events feature (§14, ADR 0069): the list, the page of an event with its
 * registration, its creation and edition, the personal calendar.
 */
export { CalendarSettings } from './components/calendar-settings';
export { EventCard } from './components/event-card';
export { EventPage } from './components/event-page';
export { EventsList } from './components/events-list';
export { LazyEventForm } from './components/lazy-event-form';
export { eventJsonLd } from './lib/json-ld';
export { readEventFilters, eventsApiQuery, myEventsQuery } from './lib/events-query';
