'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type ComponentProps, useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { exponentOf } from '@/lib/format/money';
import { currencyAffix, formatMoneyInput, parseMoneyInput } from '@/lib/format/money-input';
import { useFieldControl } from './field';
import { controlClasses } from './input';

type MoneyInputProps = Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Amount in minor units of the currency (`"1250"` is 12,50 €), null when empty or unreadable. */
  value: string | null;
  onChange: (minor: string | null) => void;
  /** ISO 4217 code: its exponent sets the decimals (XAF none, EUR two). */
  currency: string;
};

/**
 * Amount field: typed in the conventions of the page language, kept in minor units of the
 * currency without any floating point (`@/lib/format/money-input`), formatted when the field is
 * left. The currency symbol sits on its side for the locale and is part of the description.
 */
export function MoneyInput({
  value,
  onChange,
  currency,
  className,
  onBlur,
  ...props
}: MoneyInputProps) {
  const locale = useLocale();
  const t = useTranslations('web.ui.money');
  const control = useFieldControl(props);
  const currencyId = useId();
  // While the person types, their own text; otherwise the value, formatted.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (value === null ? '' : formatMoneyInput(value, locale, currency));
  const { symbol, position } = currencyAffix(locale, currency);
  const currencyName =
    new Intl.DisplayNames([locale], { type: 'currency' }).of(currency) ?? currency;

  return (
    <div className="relative">
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 flex items-center text-muted',
          position === 'prefix' ? 'left-3' : 'right-3',
        )}
      >
        {symbol}
      </span>
      <input
        {...control}
        aria-describedby={cn(control['aria-describedby'], currencyId) || undefined}
        type="text"
        inputMode={exponentOf(currency) > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={text}
        onFocus={() => setDraft(text)}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(parseMoneyInput(event.target.value, locale, currency));
        }}
        onBlur={(event) => {
          // An unreadable text stays as typed (the field is invalid); a readable one is formatted.
          setDraft(parseMoneyInput(text, locale, currency) === null && text !== '' ? text : null);
          onBlur?.(event);
        }}
        className={cn(
          controlClasses,
          'h-11 text-right tabular-nums',
          position === 'prefix' ? 'pr-3 pl-10' : 'pr-10 pl-3',
          className,
        )}
      />
      <span id={currencyId} className="sr-only">
        {t('currency', { currency: currencyName })}
      </span>
    </div>
  );
}
