import { createTranslator } from 'next-intl';
import { asLocale } from '@/i18n/routing';
import { messagesFor } from '@/lib/i18n/messages';
import { renderShareImage, shareImageSize } from '@/lib/seo/share-image';

export const contentType = 'image/png';

/** Description of the locale, without request data: also evaluated at build time. */
function description(locale: string): string {
  const lang = asLocale(locale);
  return createTranslator({ locale: lang, messages: messagesFor(lang), namespace: 'web.metadata' })(
    'description',
  );
}

/** Localised alternative text of the default share image of the locale. */
export function generateImageMetadata({ params }: { params: { locale: string } }) {
  return [
    {
      id: 'default',
      alt: description(params.locale),
      size: shareImageSize('twitter'),
      contentType,
    },
  ];
}

/** Default share image of every page of the locale, until a page defines its own. */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return renderShareImage('twitter', description(locale));
}
