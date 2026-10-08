/**
 * Translation of validation issues, from Zod in the browser and from the api (RFC 9457 `errors`,
 * which carry the Zod code only). Keys under `web.forms.issues` (docs/design/patterns.md).
 */

/** What the translator of `web.forms.issues` accepts. */
export type IssueTranslator = (key: string, values?: Record<string, string | number>) => string;

/** The fields of a Zod issue the messages use (zod/v4/core `$ZodRawIssue`). */
export interface IssueLike {
  code: string;
  input?: unknown;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  format?: string;
  inclusive?: boolean;
}

const SIZED_ORIGINS = new Set(['string', 'number', 'array', 'set', 'file']);
const FORMATS = new Set(['email', 'url', 'uuid', 'date', 'datetime', 'time']);

function bound(value: number | bigint | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

/** Message of an issue raised in the browser, with its bounds when it has them. */
export function issueMessage(t: IssueTranslator, issue: IssueLike): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === null || issue.input === ''
        ? t('required')
        : t('invalid_type');
    case 'too_small': {
      const minimum = bound(issue.minimum);
      if (issue.origin === 'string' && minimum === 1) return t('required');
      if (minimum !== undefined && issue.origin && SIZED_ORIGINS.has(issue.origin)) {
        return t(`too_small.${issue.origin}`, { minimum });
      }
      return t('too_small.generic');
    }
    case 'too_big': {
      const maximum = bound(issue.maximum);
      if (maximum !== undefined && issue.origin && SIZED_ORIGINS.has(issue.origin)) {
        return t(`too_big.${issue.origin}`, { maximum });
      }
      return t('too_big.generic');
    }
    case 'invalid_format':
      return issue.format && FORMATS.has(issue.format)
        ? t(`invalid_format.${issue.format}`)
        : t('invalid_format.generic');
    case 'invalid_value':
    case 'invalid_union':
    case 'not_multiple_of':
    case 'unrecognized_keys':
      return t(issue.code);
    default:
      return t('invalid');
  }
}

/** Message of an issue the api reported: its code only, without bounds. */
export function serverIssueMessage(t: IssueTranslator, code: string): string {
  return issueMessage(t, { code, input: code === 'invalid_type' ? null : '' });
}
