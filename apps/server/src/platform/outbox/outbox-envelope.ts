import type { DomainEventPayload } from '../kernel';

/** Serialized form of a domain event, as stored in the outbox and carried by queue jobs. */
export interface OutboxEnvelope {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  payload: DomainEventPayload;
}
