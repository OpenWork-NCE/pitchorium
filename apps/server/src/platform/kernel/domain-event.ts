export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type DomainEventPayload = { [key: string]: JsonValue };

/** `<module>.<aggregate>.<fact in past tense>.v<version>`, for example `projects.campaign.published.v1`. */
export const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+\.v[1-9][0-9]*$/;

export function isValidEventType(type: string): boolean {
  return EVENT_TYPE_PATTERN.test(type);
}

export interface DomainEventProps<TPayload extends DomainEventPayload> {
  id: string;
  aggregateId: string;
  occurredAt: Date;
  payload: TPayload;
}

/**
 * Fact that happened in a module. Subclasses fix `type` and `aggregateType`; the payload must
 * be JSON-serializable because events travel through the outbox.
 */
export abstract class DomainEvent<TPayload extends DomainEventPayload = DomainEventPayload> {
  abstract readonly type: string;
  abstract readonly aggregateType: string;
  readonly id: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;

  protected constructor(props: DomainEventProps<TPayload>) {
    this.id = props.id;
    this.aggregateId = props.aggregateId;
    this.occurredAt = props.occurredAt;
    this.payload = props.payload;
  }
}
