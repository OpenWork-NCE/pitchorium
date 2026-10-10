/**
 * Scale of a bar chart (BarChart): graduations of the vertical axis and heights of the bars, in
 * integers. A value is a count or an amount in minor units, never a floating point amount: the
 * graduations are whole multiples of a round step (1, 2 or 5 times a power of ten), at least 1.
 */

/** Graduations from 0 to the first round value at or above the largest one, `count` steps at most. */
export function chartTicks(max: number, count = 4): number[] {
  const top = Math.max(0, Math.ceil(max));
  if (top === 0) return [0];
  const rough = top / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((factor) => factor * power).find((s) => s >= rough)!,
  );
  const ticks: number[] = [];
  for (let tick = 0; tick < top + step; tick += step) ticks.push(tick);
  return ticks;
}

/**
 * Height of each bar in hundredths of the top graduation, for drawing only: a value above zero
 * stays visible (2 at least) next to a much larger one, a negative one (a refund larger than what
 * was given) is drawn as empty.
 */
export function barHeights(values: readonly number[], top: number): number[] {
  return values.map((value) =>
    value <= 0 || top <= 0 ? 0 : Math.max(2, Math.min(100, (value / top) * 100)),
  );
}

/** Index of the largest value (the first of equals), or -1 when none is above zero. */
export function peakIndex(values: readonly number[]): number {
  let peak = -1;
  values.forEach((value, index) => {
    if (value > 0 && (peak === -1 || value > values[peak]!)) peak = index;
  });
  return peak;
}

/** True when there is nothing to draw: no value, or none above zero. */
export function isEmptySeries(values: readonly number[]): boolean {
  return peakIndex(values) === -1;
}
