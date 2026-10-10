/**
 * Saves a CSV of the api (RFC 4180, UTF-8, cells already protected against formulas by the api)
 * as a file: the text stays in memory for the time of the download only, nothing is kept in the
 * browser.
 */
export function downloadCsv(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
