/** Kind of device of a session, read from its user agent. */
export type DeviceKind = 'computer' | 'phone' | 'tablet';

/**
 * Device, browser and system of a session, read from its user agent; null parts stay unnamed.
 * Never a place: the address of a session is not located (ADR 0107).
 */
export interface DeviceDescription {
  device: DeviceKind | null;
  browser: string | null;
  system: string | null;
}

const BROWSERS: readonly [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: readonly [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

/** Tablets first: an Android tablet has no « Mobile » token, an iPad says so. */
const DEVICES: readonly [RegExp, DeviceKind][] = [
  [/iPad|Tablet|Android(?!.*Mobile)/, 'tablet'],
  [/iPhone|iPod|Mobile|Android/, 'phone'],
  [/Windows|Macintosh|Mac OS X|CrOS|X11|Linux/, 'computer'],
];

/** Names a device for the list of sessions (« Firefox, Windows »), without any fingerprinting. */
export function describeUserAgent(userAgent: string | null | undefined): DeviceDescription {
  const value = userAgent ?? '';
  return {
    device: DEVICES.find(([pattern]) => pattern.test(value))?.[1] ?? null,
    browser: BROWSERS.find(([pattern]) => pattern.test(value))?.[1] ?? null,
    system: SYSTEMS.find(([pattern]) => pattern.test(value))?.[1] ?? null,
  };
}
