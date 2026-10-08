/**
 * Places modules among the items of a list: the first after `first` items, then one every
 * `every` items, while modules remain; with fewer items than `first`, one module closes the list.
 * `start` counts the items already shown above (the next page of a list goes on counting).
 */
export function interleave<Item, Module>(
  items: readonly Item[],
  modules: readonly Module[],
  { first, every }: { first: number; every: number },
  start = 0,
): ({ kind: 'item'; value: Item } | { kind: 'module'; value: Module })[] {
  const result: ({ kind: 'item'; value: Item } | { kind: 'module'; value: Module })[] = [];
  let next = 0;
  items.forEach((item, index) => {
    result.push({ kind: 'item', value: item });
    const position = start + index + 1;
    const due = position === first || (position > first && (position - first) % every === 0);
    const placed = modules[next];
    if (due && placed !== undefined) {
      result.push({ kind: 'module', value: placed });
      next += 1;
    }
  });
  const closing = modules[next];
  if (items.length < first && closing !== undefined)
    result.push({ kind: 'module', value: closing });
  return result;
}

/** Slices of `size` (3 suggestions per module of the feed). */
export function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}
