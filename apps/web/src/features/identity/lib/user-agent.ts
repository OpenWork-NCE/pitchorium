/** Browser and system of a session, read from its user agent; null parts stay unnamed. */
export interface DeviceDescription {
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

/** Names a device for the list of sessions (« Firefox, Windows »), without any fingerprinting. */
export function describeUserAgent(userAgent: string | null | undefined): DeviceDescription {
  const value = userAgent ?? '';
  return {
    browser: BROWSERS.find(([pattern]) => pattern.test(value))?.[1] ?? null,
    system: SYSTEMS.find(([pattern]) => pattern.test(value))?.[1] ?? null,
  };
}
