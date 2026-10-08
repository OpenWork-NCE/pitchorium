'use client';

import '@/lib/zod';

import { zodResolver } from '@hookform/resolvers/zod';
import { ApiProblemError } from '@pitchorium/api-client';
import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, type ReactNode, useCallback } from 'react';
import {
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  type UseFormProps,
  type UseFormReturn,
  useController,
  useForm,
  useFormContext,
} from 'react-hook-form';
import type { z } from 'zod';
import { cn } from '@/lib/cn';
import { usePlural } from '@/lib/i18n/plural';
import { fieldIssues } from '@/lib/forms/problem';
import { type IssueTranslator, issueMessage, serverIssueMessage } from '@/lib/forms/issues';
import { Field } from './field';

/**
 * react-hook-form on a schema of @pitchorium/contracts: Zod validates in the browser with the
 * messages of `web.forms.issues` (never Zod's own English texts); the api validates again.
 */
export function useZodForm<Schema extends z.ZodType<FieldValues, FieldValues>>(
  schema: Schema,
  options?: Omit<UseFormProps<z.input<Schema>, unknown, z.output<Schema>>, 'resolver'>,
): UseFormReturn<z.input<Schema>, unknown, z.output<Schema>> {
  const t = useTranslations('web.forms.issues');
  const translate: IssueTranslator = (key, values) => t(key as Parameters<typeof t>[0], values);
  return useForm<z.input<Schema>, unknown, z.output<Schema>>({
    mode: 'onTouched',
    ...options,
    resolver: zodResolver(schema, { error: (issue) => issueMessage(translate, issue) }),
  });
}

/**
 * Puts the errors of a failed api call on the form (RFC 9457): each field error under its field
 * (`errors[].pointer`), translated from its code; any other problem as the error of the whole
 * form (`errors.<code>`), with its request id. Returns false for an error that is not a problem
 * of the api (network): the caller decides.
 */
export function useApplyProblem<Values extends FieldValues>(
  form: UseFormReturn<Values, unknown, unknown>,
) {
  const t = useTranslations('web.forms.issues');
  const issues: IssueTranslator = useCallback(
    (key, values) => t(key as Parameters<typeof t>[0], values),
    [t],
  );
  const errors = useTranslations('errors');
  const forms = useTranslations('web.forms');
  return useCallback(
    (error: unknown): boolean => {
      if (!(error instanceof ApiProblemError)) return false;
      const fields = fieldIssues(error.problem);
      const known = new Set(Object.keys(form.getValues()));
      let focused = false;
      for (const issue of fields) {
        const root = issue.path.split('.')[0] ?? '';
        if (!issue.path || !known.has(root)) continue;
        form.setError(
          issue.path as FieldPath<Values>,
          { type: 'server', message: serverIssueMessage(issues, issue.code) },
          { shouldFocus: !focused },
        );
        focused = true;
      }
      if (!focused) {
        const code = error.problem.code;
        const message = errors.has(code) ? errors(code) : forms('unexpected');
        form.setError('root.server', {
          type: code,
          message: error.requestId
            ? `${message} ${forms('reference', { reference: error.requestId })}`
            : message,
        });
      }
      return true;
    },
    [form, issues, errors, forms],
  );
}

type FormProps<Values extends FieldValues, Output> = Omit<ComponentProps<'form'>, 'onSubmit'> & {
  form: UseFormReturn<Values, unknown, Output>;
  onSubmit: (values: Output) => unknown;
  children: ReactNode;
};

/**
 * Form of the design system: no native validation bubbles (the messages are ours), the first
 * invalid field focused on submit, and a summary announced at once (`role=alert`) for the
 * field errors and the error of the whole form.
 */
export function Form<Values extends FieldValues, Output>({
  form,
  onSubmit,
  children,
  className,
  ...props
}: FormProps<Values, Output>) {
  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        className={cn('grid gap-5', className)}
        {...props}
      >
        <FormSummary />
        {children}
      </form>
    </FormProvider>
  );
}

function FormSummary() {
  const t = useTranslations('web.forms');
  const plural = usePlural();
  const { formState } = useFormContext();
  const root = formState.errors.root?.server?.message;
  const count = Object.keys(formState.errors).filter((name) => name !== 'root').length;
  const show = formState.isSubmitted && (root || count > 0);
  return (
    <div role="alert" aria-atomic="true" className={show ? undefined : 'sr-only'}>
      {show ? (
        <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="grid gap-1">
            {count > 0 ? (
              <p className="font-medium">{t(`summary.${plural(count)}`, { count })}</p>
            ) : null}
            {root ? <p>{root}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface FormFieldProps<Values extends FieldValues, Name extends FieldPath<Values>> {
  name: Name;
  label: ReactNode;
  hideLabel?: boolean;
  description?: ReactNode;
  required?: boolean;
  optional?: boolean;
  /** Limit of characters, shown as a counter under the control. */
  maxLength?: number;
  render: (props: {
    field: ControllerRenderProps<Values, Name>;
    fieldState: ControllerFieldState;
  }) => ReactNode;
}

/** A field of a Form: its label, description, translated error and counter, bound by name. */
export function FormField<Values extends FieldValues, Name extends FieldPath<Values>>({
  name,
  label,
  hideLabel,
  description,
  required,
  optional,
  maxLength,
  render,
}: FormFieldProps<Values, Name>) {
  const { control } = useFormContext<Values>();
  const { field, fieldState } = useController({ name, control });
  const value: unknown = field.value;
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <Field
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
