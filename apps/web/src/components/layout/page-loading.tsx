import { useTranslations } from 'next-intl';

/** Pending navigation: a thin indeterminate bar under the header, announced to screen readers. */
export function PageLoading() {
  const t = useTranslations('web.a11y');
  return (
    <div
      data-page-loading
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-(--z-toast) h-0.5 overflow-hidden"
    >
      <span className="sr-only">{t('loading')}</span>
      <span className="block h-full w-1/3 animate-[loading-bar_1.2s_var(--ease-curtain)_infinite] bg-accent motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}
