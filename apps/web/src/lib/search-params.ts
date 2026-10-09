/** First value of a search parameter, null when absent or empty. */
export function firstParam(
  params: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = params[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : null;
}
