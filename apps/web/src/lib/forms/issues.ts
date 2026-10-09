/**
 * Translation of validation issues, from Zod in the browser and from the api (RFC 9457 `errors`,
 * which carry the Zod code and its precise reason). Keys under `web.forms`
 * (docs/design/patterns.md), from the most precise: the rule of a refinement of the web
 * (`rules.<rule>`), the reason for this field (`fields.<field>.<reason>`), the code for this field
 * (`fields.<field>.<code>`), the reason (`reasons.<reason>`), then the code with its bounds. The
 * message always says the reason the value was refused, never another rule of the field.
 */

/** What the translator of `web.forms` accepts, with `has` to look for a specific message. */
export interface IssueTranslator {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
}

/** The fields of a Zod issue the messages use (zod/v4/core `$ZodRawIssue`). */
export interface IssueLike {
  code: string;
  input?: unknown;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  format?: string;
  inclusive?: boolean;
  /**
   * `rule` names the message of a refinement of the web (`rules.<rule>`), `reason` the precise
   * reason of a refinement of the contracts (`https_required`).
   */
  params?: Record<string, unknown>;
  /** The precise reason given by the api (`reason` of RFC 9457 `errors`). */
  reason?: string;
}

/** The precise reason of an issue: given by the api, declared by a refinement, or its format. */
function reasonOf(issue: IssueLike): string | undefined {
  if (issue.reason) return issue.reason;
  const declared = issue.params?.['reason'];
  if (typeof declared === 'string') return declared;
  return issue.code === 'invalid_format' ? issue.format : undefined;
}

const SIZED_ORIGINS = new Set(['string', 'number', 'array', 'set', 'file']);
const FORMATS = new Set(['email', 'url', 'uuid', 'date', 'datetime', 'time']);

function bound(value: number | bigint | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

/** Last name of a path (`members.0.email` is `email`): the key of the messages of a field. */
export function fieldOf(path: string): string {
  return (
    path
      .split('.')
      .filter((segment) => !/^\d+$/.test(segment))
      .at(-1) ?? ''
  );
}

function isEmpty(input: unknown): boolean {
  return input === undefined || input === null || input === '';
}

/**
 * Message of an issue raised in the browser for a field (its path), with its bounds when it has
 * them. `format` formats the bounds in the language of the page (12 000, not 12000).
 */
export function issueMessage(
  t: IssueTranslator,
  issue: IssueLike,
  path = '',
  format: (value: number) => string = String,
): string {
  const field = fieldOf(path);
  const required =
    (issue.code === 'invalid_type' && isEmpty(issue.input)) ||
    // An empty text fails a pattern: it is missing before it is malformed.
    (issue.code === 'invalid_format' && issue.input === '') ||
    (issue.code === 'too_small' && issue.origin === 'string' && bound(issue.minimum) === 1);
  const code = required ? 'required' : issue.code;
  const minimum = bound(issue.minimum);
  const maximum = bound(issue.maximum);
  const values = {
    ...(minimum === undefined ? {} : { minimum: format(minimum) }),
    ...(maximum === undefined ? {} : { maximum: format(maximum) }),
  };

  const rule = issue.params?.['rule'];
  if (typeof rule === 'string' && t.has(`rules.${rule}`)) return t(`rules.${rule}`, values);
  const reason = required ? undefined : reasonOf(issue);
  if (field && reason && t.has(`fields.${field}.${reason}`)) {
    return t(`fields.${field}.${reason}`, values);
  }
  if (field && t.has(`fields.${field}.${code}`)) return t(`fields.${field}.${code}`, values);
  if (reason && t.has(`reasons.${reason}`)) return t(`reasons.${reason}`, values);

  switch (code) {
    case 'required':
      return t('issues.required');
    case 'invalid_type':
      return t('issues.invalid_type');
    case 'too_small':
      if (minimum === 1 && (issue.origin === 'array' || issue.origin === 'set')) {
        return t('issues.too_small.one');
      }
      return minimum !== undefined && issue.origin && SIZED_ORIGINS.has(issue.origin)
        ? t(`issues.too_small.${issue.origin}`, values)
        : t('issues.too_small.generic');
    case 'too_big':
      if (maximum === 1 && (issue.origin === 'array' || issue.origin === 'set')) {
        return t('issues.too_big.one');
      }
      return maximum !== undefined && issue.origin && SIZED_ORIGINS.has(issue.origin)
        ? t(`issues.too_big.${issue.origin}`, values)
        : t('issues.too_big.generic');
    case 'invalid_format':
      return reason && FORMATS.has(reason)
        ? t(`issues.invalid_format.${reason}`)
        : t('issues.invalid_format.generic');
    case 'invalid_value':
    case 'invalid_union':
    case 'not_multiple_of':
    case 'unrecognized_keys':
      return t(`issues.${code}`);
    default:
      return t('issues.invalid');
  }
}

/**
 * Message of an issue the api reported (its code only), with the bounds and the format the
 * schema of the form gives for the field (the same rules as the api's, from the contracts).
 */
export function serverIssueMessage(
  t: IssueTranslator,
  code: string,
  path: string,
  rules: Partial<IssueLike> = {},
  format?: (value: number) => string,
  reason?: string,
): string {
  return issueMessage(
    t,
    {
      ...rules,
      code,
      input: code === 'invalid_type' ? null : undefined,
      // The reason of the api replaces the format the schema of the form declares.
      ...(reason ? { reason } : {}),
    },
    path,
    format,
  );
}
