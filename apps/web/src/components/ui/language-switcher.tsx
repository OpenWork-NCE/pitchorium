'use client';

import { Check, Languages } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { buttonVariants } from './button';

export interface LanguageOption {
  /** BCP 47 code: `lang` and `hreflang` of the link. */
  code: string;
  /** Name of the language in itself (Français, English). */
  label: string;
  /** Same page in that language, query string included. */
  href: string;
}

interface LanguageSwitcherProps {
  /** Accessible name of the button (translated). */
  label: string;
  current: string;
  /** Active languages only (§8.3): the caller never lists one that is not. */
  options: readonly LanguageOption[];
  className?: string;
}

/**
 * Language selector: a disclosure of links (WAI-ARIA disclosure navigation), since changing the
 * language is going to another URL. No menu library: it weighs a few hundred bytes on the
 * editorial pages (ADR 0094). Escape, a click outside and the focus leaving close it. Absent
 * below two active languages.
 */
export function LanguageSwitcher({ label, current, options, className }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
    };
    const element = root.current;
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    element?.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      element?.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);

  if (options.length < 2) return null;

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        <Languages aria-hidden />
        {/* The visible code is part of the accessible name (WCAG 2.5.3, label in name). */}
        <span className="sr-only">{label}</span>
        <span>{current.toUpperCase()}</span>
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-(--z-overlay) mt-2 min-w-44 origin-top-right animate-[menu-in_var(--duration-micro)_var(--ease-enter)] rounded-lg border border-border bg-surface-elevated p-1 text-foreground shadow-md"
      >
        {options.map((option) => (
          <li key={option.code}>
            <a
              href={option.href}
              hrefLang={option.code}
              lang={option.code}
              aria-current={option.code === current ? 'true' : undefined}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken aria-[current]:font-medium"
            >
              <span className="inline-flex size-4 items-center justify-center">
                {option.code === current ? <Check aria-hidden className="size-4" /> : null}
              </span>
              {option.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
