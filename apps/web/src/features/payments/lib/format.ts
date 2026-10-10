/** Date and time of an instant of the api, short, in the language and time zone of the page. */
export function formatDateTimeShort(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** Date of an instant or a calendar day of the api, in the language of the page. */
export function formatDate(iso: string, locale: string): string {
  // A calendar day (`2026-10-10`) is read at noon UTC: the same day in every time zone.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}
