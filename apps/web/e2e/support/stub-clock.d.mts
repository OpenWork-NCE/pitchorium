export const STUB_EPOCH: number;
export function stubNow(): number;
export function stubIso(offsetMs?: number): string;
export function stubClockEnv(): {
  STUB_CLOCK_START: string;
  STUB_CLOCK_EPOCH: string;
  NODE_OPTIONS: string;
};
