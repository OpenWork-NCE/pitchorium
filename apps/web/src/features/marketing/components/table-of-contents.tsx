'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * « Sur cette page » of a long editorial page on a computer (transparency, ADR 0156): the anchors
 * of its sections, sticky beside the reading column, the section being read marked
 * (`aria-current`, from an IntersectionObserver). Without script, a plain list of anchors.
 */
export function TableOfContents({
  label,
  sections,
}: {
  label: string;
  sections: readonly { id: string; title: string }[];
}) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const targets = sections
      .map((section) => document.getElementById(section.id)?.closest('section'))
      .filter((element): element is HTMLElement => Boolean(element));
    // The section whose top crossed the upper third of the screen last is the one read.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]!;
        setActive(top.target.querySelector('[id]')?.id ?? null);
      },
      { rootMargin: '0px 0px -66% 0px' },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [sections]);
  return (
    <nav
      aria-label={label}
      className="sticky top-[calc(var(--header-height,4.5rem)+1.5rem)] hidden self-start lg:block"
    >
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <ol className="mt-3 grid gap-1 border-l border-border">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? 'location' : undefined}
              className={cn(
                '-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-muted hover:text-foreground',
                'aria-[current=location]:border-accent aria-[current=location]:font-medium aria-[current=location]:text-foreground',
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
