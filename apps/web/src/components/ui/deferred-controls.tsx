'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { Combobox } from './combobox';
import type { Select } from './select';
import { FieldSkeleton } from './skeleton';

const ComboboxImpl = lazy(() =>
  import('./combobox').then((module) => ({ default: module.Combobox })),
);
const SelectImpl = lazy(() => import('./select').then((module) => ({ default: module.Select })));

/**
 * `Combobox` loaded after the page (its search, cmdk and Radix Popover stay off the first load,
 * ADR 0094): a field skeleton with its placeholder until it arrives. For a page whose first load
 * is counted; a form already loaded at the first use (a dialog) takes `Combobox` itself.
 */
export function DeferredCombobox(props: ComponentProps<typeof Combobox>) {
  return (
    <Suspense fallback={<FieldSkeleton hint={props.placeholder} />}>
      <ComboboxImpl {...props} />
    </Suspense>
  );
}

/** `Select` loaded after the page (Radix Select and its positioning), as `DeferredCombobox`. */
export function DeferredSelect<T extends string>(props: Parameters<typeof Select<T>>[0]) {
  const Impl = SelectImpl as unknown as typeof Select<T>;
  return (
    <Suspense fallback={<FieldSkeleton hint={props.placeholder} />}>
      <Impl {...props} />
    </Suspense>
  );
}
