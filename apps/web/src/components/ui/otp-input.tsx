'use client';

import { useTranslations } from 'next-intl';
import { type ComponentProps, useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './field';

type OtpInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'maxLength' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
  /** Called once every digit is typed (to submit at once). */
  onComplete?: (value: string) => void;
  length?: number;
};

/**
 * Code received by email or by an authenticator: one real input (`autocomplete=one-time-code`,
 * numeric keyboard, paste of the whole code), drawn as one box per digit. Screen readers and
 * password managers see a single field.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  className,
  ...props
}: OtpInputProps) {
  const t = useTranslations('web.ui.otp');
  const control = useFieldControl(props);
  const hintId = useId();
  const [focused, setFocused] = useState(false);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');
  const active = Math.min(value.length, length - 1);

  return (
    <div className={cn('relative inline-flex gap-2', className)}>
      <input
        {...control}
        aria-describedby={cn(control['aria-describedby'], hintId) || undefined}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`\\d{${length}}`}
        value={value}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '').slice(0, length);
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        className="absolute inset-0 z-[1] h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
      />
      <span id={hintId} className="sr-only">
        {t('hint', { length })}
      </span>
      {digits.map((digit, index) => (
        <span
          // The boxes are drawn from the value: their order is their identity.
          key={index}
          aria-hidden
          data-active={focused && index === active ? '' : undefined}
          className={cn(
            'flex size-12 items-center justify-center rounded-md border border-border-strong bg-surface font-display text-2xl font-extrabold tabular-nums transition-colors duration-(--duration-micro)',
            'data-[active]:border-focus data-[active]:outline-2 data-[active]:outline-focus',
            control['aria-invalid'] ? 'border-danger' : undefined,
            control.disabled ? 'opacity-50' : undefined,
          )}
        >
          {digit.trim()}
        </span>
      ))}
    </div>
  );
}
