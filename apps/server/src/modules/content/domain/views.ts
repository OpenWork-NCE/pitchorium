/** Day (UTC) of a view of a publication, `YYYY-MM-DD`. */
export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}
