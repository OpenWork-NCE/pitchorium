import { getLocale, getTranslations } from 'next-intl/server';
import { BrandMicro } from '@/components/brand';
import { Container } from '@/components/layout/container';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { getActiveLocales } from '@/lib/i18n/active-locales';
import { LEGAL_DOCUMENTS } from '../lib/legal-documents';

/**
 * Footer of the public pages (ADR 0156): the editorial pages, the legal pages, the home page in
 * each active locale (the header switches the language of the page itself) and the contact
 * address of the configuration, shown only when set. No social network is listed. `uncover` pins
 * it under the content of an editorial page (H29). A server component: no client code.
 */
export async function SiteFooter({
  contactEmail,
  uncover = false,
}: {
  contactEmail: string | undefined;
  uncover?: boolean;
}) {
  const [t, names, current, { locales }] = await Promise.all([
    getTranslations('web.marketing'),
    getTranslations('web.locale.names'),
    getLocale(),
    getActiveLocales(),
  ]);
  // 44 px targets on a phone (direction.md), the text line on a computer.
  const link =
    'link-underline-hover inline-flex min-h-11 items-center rounded-sm text-muted hover:text-foreground md:min-h-0';
  return (
    <footer
      aria-label={t('footer.label')}
      className={`border-t border-border bg-surface${uncover ? 'footer-uncover' : ''}`}
    >
      <Container className="grid gap-10 py-12 md:grid-cols-[1fr_auto_auto] md:gap-16">
        <div className="grid content-start gap-3">
          <BrandMicro size={24} />
          <p className="text-sm text-muted">{t('footer.tagline')}</p>
        </div>
        <nav aria-labelledby="footer-site" className="grid content-start gap-3 text-sm">
          <p id="footer-site" className="font-semibold">
            {t('footer.about')}
          </p>
          <ul className="grid md:gap-2">
            <li>
              <Link className={link} href={routes.howItWorks}>
                {t('nav.howItWorks')}
              </Link>
            </li>
            <li>
              <Link className={link} href={routes.transparency}>
                {t('nav.transparency')}
              </Link>
            </li>
            <li>
              <Link className={link} href={routes.projects}>
                {t('nav.projects')}
              </Link>
            </li>
            <li>
              <Link className={link} href={routes.impactMethodology}>
                {t('nav.methodology')}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-legal" className="grid content-start gap-3 text-sm">
          <p id="footer-legal" className="font-semibold">
            {t('footer.legal')}
          </p>
          <ul className="grid md:gap-2">
            {LEGAL_DOCUMENTS.map((document) => (
              <li key={document}>
                <Link className={link} href={routes.legal(document)}>
                  {t(`legalNames.${document}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <Container className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border py-6 text-sm">
        <nav
          aria-label={t('footer.language')}
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <span className="text-muted">{t('footer.language')}</span>
          {locales.map((locale) => (
            <a
              key={locale}
              href={`/${locale}`}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? 'true' : undefined}
              className={`${link} aria-[current=true]:font-semibold aria-[current=true]:text-foreground`}
            >
              {names(locale)}
            </a>
          ))}
        </nav>
        {contactEmail ? (
          <p className="text-muted">
            {t.rich('footer.contact', {
              address: contactEmail,
              email: (chunks) => (
                <a
                  className="link-underline-hover text-accent underline"
                  href={`mailto:${contactEmail}`}
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        ) : null}
      </Container>
    </footer>
  );
}
