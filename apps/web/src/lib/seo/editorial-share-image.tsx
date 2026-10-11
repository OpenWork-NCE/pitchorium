import { createTranslator } from 'next-intl';
import { asLocale } from '@/i18n/routing';
import { messagesFor } from '@/lib/i18n/messages';
import { renderShareImage, type ShareFormat, shareImageSize } from './share-image';

/** A key of the `web` catalogue read without request data: also evaluated at build time. */
function textOf(locale: string, key: string): string {
  const lang = asLocale(locale);
  return createTranslator({ locale: lang, messages: messagesFor(lang), namespace: 'web' })(
    key as never,
  );
}

/**
 * Share image of an editorial page (ADR 0156): its title on the background of the brand, with
 * the title as alternative text. `key` gives the title from the parameters of the route.
 */
export function editorialShareImage(
  format: ShareFormat,
  key: (params: Record<string, string>) => string,
) {
  return {
    generateImageMetadata: ({ params }: { params: Record<string, string> }) => {
      return [
        {
          id: 'default',
          alt: textOf(params.locale ?? 'fr', key(params)),
          size: shareImageSize(format),
          contentType: 'image/png',
        },
      ];
    },
    Image: async ({ params }: { params: Promise<Record<string, string>> }) => {
      const values = await params;
      return renderShareImage(format, textOf(values.locale ?? 'fr', key(values)));
    },
  };
}
