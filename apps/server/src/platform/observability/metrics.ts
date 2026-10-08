import { type Counter, metrics } from '@opentelemetry/api';

export type MetricAttributes = Readonly<Record<string, string>>;

/**
 * Port for application metrics. Counters are exported through OpenTelemetry (OTLP) when
 * OTEL_EXPORTER_OTLP_ENDPOINT is set; otherwise the global meter is a no-op.
 */
export abstract class Metrics {
  /** Adds one to the counter `name` (`pitchorium.<module>.<subject>`), with its attributes. */
  abstract increment(name: string, attributes?: MetricAttributes): void;
  /** Adds a quantity to the counter `name` (characters sent to a provider, for example). */
  abstract add(name: string, value: number, attributes?: MetricAttributes): void;
}

export class OpenTelemetryMetrics extends Metrics {
  private readonly meter = metrics.getMeter('pitchorium');
  private readonly counters = new Map<string, Counter>();

  increment(name: string, attributes: MetricAttributes = {}): void {
    this.add(name, 1, attributes);
  }

  add(name: string, value: number, attributes: MetricAttributes = {}): void {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = this.meter.createCounter(name);
      this.counters.set(name, counter);
    }
    counter.add(value, attributes);
  }
}
