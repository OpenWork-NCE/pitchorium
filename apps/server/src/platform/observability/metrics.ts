import { type Counter, type Gauge, type Histogram, metrics } from '@opentelemetry/api';

export type MetricAttributes = Readonly<Record<string, string>>;

/**
 * Port for application metrics. Instruments are exported through OpenTelemetry (OTLP) when
 * OTEL_EXPORTER_OTLP_ENDPOINT is set; otherwise the global meter is a no-op. The emitted names
 * are listed in docs/operations/slo-and-alerts.md.
 */
export abstract class Metrics {
  /** Adds one to the counter `name` (`pitchorium.<module>.<subject>`), with its attributes. */
  abstract increment(name: string, attributes?: MetricAttributes): void;
  /** Adds a quantity to the counter `name` (characters sent to a provider, for example). */
  abstract add(name: string, value: number, attributes?: MetricAttributes): void;
  /** Records one measure in the histogram `name` (a duration, a lag). */
  abstract record(name: string, value: number, attributes?: MetricAttributes): void;
  /** Sets the current value of the gauge `name` (a queue depth). */
  abstract gauge(name: string, value: number, attributes?: MetricAttributes): void;
}

export class OpenTelemetryMetrics extends Metrics {
  private readonly meter = metrics.getMeter('pitchorium');
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();
  private readonly gauges = new Map<string, Gauge>();

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

  record(name: string, value: number, attributes: MetricAttributes = {}): void {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = this.meter.createHistogram(name);
      this.histograms.set(name, histogram);
    }
    histogram.record(value, attributes);
  }

  gauge(name: string, value: number, attributes: MetricAttributes = {}): void {
    let gauge = this.gauges.get(name);
    if (!gauge) {
      gauge = this.meter.createGauge(name);
      this.gauges.set(name, gauge);
    }
    gauge.record(value, attributes);
  }
}
