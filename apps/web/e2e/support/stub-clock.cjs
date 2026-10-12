// Preloaded by the server of the pages under test (`next start`, NODE_OPTIONS from
// stub-clock.mjs, ADR 0171): its Date starts at the fixed date of the stub api at the shared
// start of the run, then flows with the real time. A proxy keeps every real date an instance of
// Date (`instanceof`, React, Next.js); only `new Date()` without argument and `Date.now()` move.
const epoch = Number(process.env.STUB_CLOCK_EPOCH);
const start = Number(process.env.STUB_CLOCK_START);

if (Number.isFinite(epoch) && Number.isFinite(start)) {
  const RealDate = Date;
  const offset = epoch - start;
  const now = () => RealDate.now() + offset;
  globalThis.Date = new Proxy(RealDate, {
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length === 0 ? [now()] : args, newTarget);
    },
    apply() {
      return new RealDate(now()).toString();
    },
    get(target, property, receiver) {
      return property === 'now' ? now : Reflect.get(target, property, receiver);
    },
  });
}
