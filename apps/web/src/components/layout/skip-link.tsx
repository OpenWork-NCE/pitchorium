import { useTranslations } from 'next-intl';

/** First focusable element of every page: jumps over the header to the main content. */
export function SkipLink() {
  const t = useTranslations('web.a11y');
  return (
    <a
      href="#main"
      className="fixed top-3 left-3 z-(--z-skip-link) -translate-y-24 rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent focus-visible:translate-y-0"
    >
      {t('skipToContent')}
    </a>
  );
}
