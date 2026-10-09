'use client';

import '@/lib/zod';

import { zodResolver } from '@hookform/resolvers/zod';
import { ApiProblemError } from '@pitchorium/api-client';
import { CircleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  type ComponentProps,
  createContext,
  type MouseEvent,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldError,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
  FormProvider,
  get,
  type UseFormProps,
  type UseFormReturn,
  useController,
  useForm,
  useFormContext,
} from 'react-hook-form';
import type { z } from 'zod';
import { cn } from '@/lib/cn';
import { type IssueTranslator, issueMessage, serverIssueMessage } from '@/lib/forms/issues';
import { fieldIssues } from '@/lib/forms/problem';
import { boundsOf } from '@/lib/forms/schema-bounds';
import { usePlural } from '@/lib/i18n/plural';
import { Field } from './field';

/**
 * What a form shares with its parts, keyed by its control: the schema (bounds of the api's
 * errors) and the focus of its summary (after a failed submit or an answer of the api).
 */
const schemas = new WeakMap<object, z.ZodType>();
const summaries = new WeakMap<object, () => void>();
const pendingFocus = new WeakSet<object>();

/**
 * Asks the summary of a form to take the focus once it shows its errors: at its next render, or
 * at the next frame if it is already there.
 */
function focusSummary(control: object) {
  pendingFocus.add(control);
  requestAnimationFrame(() => summaries.get(control)?.());
}

/** Translator of `web.forms`, numbers formatted in the language of the page. */
function useIssueTranslator(): { t: IssueTranslator; format: (value: number) => string } {
  const translations = useTranslations('web.forms');
  const locale = useLocale();
  const t = useMemo<IssueTranslator>(
    () =>
      Object.assign(
        (key: string, values?: Record<string, string | number>) =>
          translations(key as Parameters<typeof translations>[0], values),
        { has: (key: string) => translations.has(key as Parameters<typeof translations.has>[0]) },
      ),
    [translations],
  );
  const format = useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  );
  return { t, format };
}

/**
 * react-hook-form on a schema of @pitchorium/contracts: Zod validates in the browser with the
 * messages of `web.forms` (the message of the field, of the rule, then of the code with its
 * bounds; never Zod's own English texts); the api validates again.
 */
export function useZodForm<Schema extends z.ZodType<FieldValues, FieldValues>>(
  schema: Schema,
  options?: Omit<UseFormProps<z.input<Schema>, unknown, z.output<Schema>>, 'resolver'>,
): UseFormReturn<z.input<Schema>, unknown, z.output<Schema>> {
  const { t, format } = useIssueTranslator();
  const form = useForm<z.input<Schema>, unknown, z.output<Schema>>({
    mode: 'onTouched',
    // The summary takes the focus, then its links lead to the fields.
    shouldFocusError: false,
    ...options,
    resolver: zodResolver(schema, {
      error: (issue) => issueMessage(t, issue, (issue.path ?? []).map(String).join('.'), format),
    }),
  });
  useEffect(() => {
    schemas.set(form.control, schema);
  }, [form.control, schema]);
  return form;
}

/** A field a code of the api is about, with the values of its message. */
type ProblemField = string | { field: string; values: Record<string, string | number> };

interface ApplyProblemOptions {
  /**
   * Codes of the api that concern one field (`EVENTS_SCHEDULE_INVALID` is about `endsAt`): the
   * message (`web.forms.problems.<code>`, else `errors.<code>`) goes under it.
   */
  fields?: Readonly<Record<string, ProblemField>>;
}

/**
 * Puts the errors of a failed api call on the form (RFC 9457): each field error under its field
 * (`errors[].pointer`), with the rule the field expects; a code of the api tied to a field under
 * that field; any other problem as the error of the whole form (`errors.<code>`), with its
 * request id. The summary then takes the focus. Returns false for an error that is not a problem
 * of the api (network): the caller decides.
 */
export function useApplyProblem<Values extends FieldValues>(
  form: UseFormReturn<Values, unknown, unknown>,
  { fields: problemFields = {} }: ApplyProblemOptions = {},
) {
  const { t, format } = useIssueTranslator();
  const errors = useTranslations('errors');
  return useCallback(
    (error: unknown): boolean => {
      if (!(error instanceof ApiProblemError)) return false;
      const schema = schemas.get(form.control);
      const known = new Set(Object.keys(form.getValues()));
      let placed = false;
      for (const issue of fieldIssues(error.problem)) {
        const root = issue.path.split('.')[0] ?? '';
        if (!issue.path || !known.has(root)) continue;
        const rules = schema ? boundsOf(schema, issue.path) : {};
        form.setError(issue.path as FieldPath<Values>, {
          type: 'server',
          message: serverIssueMessage(t, issue.code, issue.path, rules, format, issue.reason),
        });
        placed = true;
      }
      const code = error.problem.code;
      const mapped = problemFields[code];
      const target = typeof mapped === 'string' ? mapped : mapped?.field;
      const values = typeof mapped === 'object' ? mapped.values : undefined;
      // The message of the precise reason first (EVENTS_SCHEDULE_INVALID: `too_long`), so that
      // the form never names another rule than the one the value broke.
      const reasonKey = error.problem.reason
        ? `problemReasons.${code}.${error.problem.reason}`
        : undefined;
      const reasoned = reasonKey && t.has(reasonKey) ? t(reasonKey, values) : undefined;
      if (!placed && target && known.has(target.split('.')[0] ?? '')) {
        form.setError(target as FieldPath<Values>, {
          type: code,
          message:
            reasoned ??
            (t.has(`problems.${code}`)
              ? t(`problems.${code}`, values)
              : errors.has(code)
                ? errors(code)
                : t('unexpected')),
        });
        placed = true;
      }
      if (!placed) {
        const message = reasoned ?? (errors.has(code) ? errors(code) : t('unexpected'));
        form.setError('root.server', {
          type: code,
          message: error.requestId
            ? `${message} ${t('reference', { reference: error.requestId })}`
            : message,
        });
      }
      focusSummary(form.control);
      return true;
    },
    [form, t, format, errors, problemFields],
  );
}

/** A field of the form as its summary links to it: its label and its control. */
interface RegisteredField {
  label: ReactNode;
  controlId: string;
}

const FormRegistry = createContext<Map<string, RegisteredField> | null>(null);

type FormProps<Values extends FieldValues, Output> = Omit<ComponentProps<'form'>, 'onSubmit'> & {
  form: UseFormReturn<Values, unknown, Output>;
  onSubmit: (values: Output) => unknown;
  children: ReactNode;
};

/**
 * Form of the design system: no native validation bubbles (the messages are ours); after a
 * failed submit, a summary lists every error with a link to its field and takes the focus.
 */
export function Form<Values extends FieldValues, Output>({
  form,
  onSubmit,
  children,
  className,
  ...props
}: FormProps<Values, Output>) {
  const [registry] = useState(() => new Map<string, RegisteredField>());
  return (
    <FormProvider {...form}>
      <FormRegistry value={registry}>
        <form
          noValidate
          onSubmit={(event) =>
            void form.handleSubmit(onSubmit, () => focusSummary(form.control))(event)
          }
          className={cn('grid gap-5', className)}
          {...props}
        >
          <FormSummary />
          {children}
        </form>
      </FormRegistry>
    </FormProvider>
  );
}

/** Moves the focus to a field: its control, or the first control inside it (a group). */
function focusField(controlId: string) {
  const element = document.getElementById(controlId);
  if (!element) return;
  const focusable = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])';
  const target = element.matches(focusable)
    ? element
    : element.querySelector<HTMLElement>(focusable);
  target?.focus();
  element.scrollIntoView?.({ block: 'center' });
}

function FormSummary() {
  const t = useTranslations('web.forms');
  const plural = usePlural();
  const registry = use(FormRegistry);
  const { formState, control } = useFormContext();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const focus = () => {
      if (!ref.current) return;
      pendingFocus.delete(control);
      ref.current.focus();
    };
    summaries.set(control, focus);
    // The errors arrived with this render: the focus asked for before it can be given now.
    if (pendingFocus.has(control)) focus();
    return () => {
      summaries.delete(control);
    };
  });

  const errors: FieldErrors = formState.errors;
  const root = errors.root?.['server']?.message;
  // The fields in the order of the form, then any error of a field the form does not show.
  const listed = [...(registry?.entries() ?? [])].flatMap(([name, field]) => {
    const message = (get(errors, name) as FieldError | undefined)?.message;
    return message ? [{ name, field, message }] : [];
  });
  // An error of a field the form does not show (set by hand): said, without a link.
  const others = Object.keys(errors).flatMap((name) => {
    const message = (get(errors, name) as FieldError | undefined)?.message;
    return name === 'root' || registry?.has(name) || !message ? [] : [{ name, message }];
  });
  const count = listed.length + others.length;
  if (!formState.isSubmitted || (!root && count === 0)) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      className="grid gap-2 rounded-lg border border-danger/40 bg-danger-subtle p-4 text-sm text-danger outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <p id={titleId} className="inline-flex items-start gap-2 font-semibold">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        {count > 0 ? t(`summary.${plural(count)}`, { count }) : t('summary.form')}
      </p>
      {count > 0 ? (
        <ul className="grid gap-1 pl-6">
          {listed.map(({ name, field, message }) => (
            <li key={name}>
              <a
                href={`#${field.controlId}`}
                className="underline underline-offset-2 hover:no-underline"
                onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                  event.preventDefault();
                  focusField(field.controlId);
                }}
              >
                {field.label}
                {t('summary.separator')}
                {message}
              </a>
            </li>
          ))}
          {others.map(({ name, message }) => (
            <li key={name}>{message}</li>
          ))}
        </ul>
      ) : null}
      {root ? <p className="pl-6">{root}</p> : null}
    </div>
  );
}

interface FormFieldProps<Values extends FieldValues, Name extends FieldPath<Values>> {
  /** The form (`form.control`): types the name and the value; the enclosing Form otherwise. */
  control?: Control<Values, unknown, unknown>;
  name: Name;
  label: ReactNode;
  hideLabel?: boolean;
  description?: ReactNode;
  required?: boolean;
  optional?: boolean;
  /** Limit of characters, shown as a counter near the limit or while the field is focused. */
  maxLength?: number;
  render: (props: {
    field: ControllerRenderProps<Values, Name>;
    fieldState: ControllerFieldState;
  }) => ReactNode;
}

/** A field of a Form: its label, description, translated error and counter, bound by name. */
export function FormField<Values extends FieldValues, Name extends FieldPath<Values>>({
  control: own,
  name,
  label,
  hideLabel,
  description,
  required,
  optional,
  maxLength,
  render,
}: FormFieldProps<Values, Name>) {
  const context = useFormContext<Values>();
  const registry = use(FormRegistry);
  const controlId = `${useId()}-control`;
  const { field, fieldState } = useController({ name, control: own ?? context.control });
  useLayoutEffect(() => {
    registry?.set(name, { label, controlId });
    return () => {
      registry?.delete(name);
    };
  }, [registry, name, label, controlId]);
  const value: unknown = field.value;
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <Field
      id={controlId}
      label={label}
      hideLabel={hideLabel}
      description={description}
      required={required}
      optional={optional}
      error={fieldState.error?.message}
      counter={maxLength ? { count: length, max: maxLength } : undefined}
    >
      {render({ field, fieldState })}
    </Field>
  );
}

/**
 * Actions of a form, the main one first in the document: stacked full width on a phone, the
 * main one on top; in a row on a wider screen, the main one on the right.
 */
export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 *:w-full sm:flex-row-reverse sm:flex-wrap sm:justify-start sm:*:w-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}
