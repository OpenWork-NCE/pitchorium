import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from './link';

interface BreadcrumbsProps {
  /** From the root to the current page, the last one without `href`. */
  items: readonly { label: string; href?: string }[];
}

/** Where a page sits in the administration (`nav` with `aria-current=page` on the last item). */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const t = useTranslations('web.ui');
  return (
    <nav aria-label={t('breadcrumbs')}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${item.href ?? 'current'}`}
              className="inline-flex items-center gap-1.5"
            >
              {item.href && !last ? (
                <Link
                  href={item.href}
                  variant="standalone"
                  className="text-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className="font-medium text-foreground"
                >
                  {item.label}
                </span>
              )}
              {last ? null : <ChevronRight aria-hidden className="size-4" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
