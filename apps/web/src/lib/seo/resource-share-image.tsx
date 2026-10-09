import 'server-only';
import {
  organizationsControllerForPublic,
  profilesControllerForPublic,
} from '@pitchorium/api-client';
import { createTranslator } from 'next-intl';
import { cache } from 'react';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { messagesFor } from '@/lib/i18n/messages';
import { renderShareImage, type ShareFormat, shareImageSize } from './share-image';

/**
 * Share images of the public pages of members and organisations (ADR 0101): read from their
 * public view only, so that a page closed to visitors shares the default image of the locale
 * and nothing of its content.
 */
interface Shared {
  title: string;
  subtitle: string | null;
}

function defaultText(locale: string): Shared {
  const lang = asLocale(locale);
  const t = createTranslator({
    locale: lang,
    messages: messagesFor(lang),
    namespace: 'web.metadata',
  });
  return { title: t('description'), subtitle: null };
}

const readMember = cache(async (handle: string): Promise<Shared | null> => {
  configureServerApi();
  const profile = await profilesControllerForPublic(handle).catch(() => null);
  return profile ? { title: profile.displayName, subtitle: profile.headline } : null;
});

const readOrganization = cache(async (locale: string, slug: string): Promise<Shared | null> => {
  configureServerApi();
  const organization = await organizationsControllerForPublic(slug).catch(() => null);
  if (!organization) return null;
  const lang = asLocale(locale);
  const reference = createTranslator({
    locale: lang,
    messages: messagesFor(lang),
    namespace: 'reference.structureTypes',
  });
  return { title: organization.name, subtitle: reference(organization.structureType) };
});

async function shared(kind: 'member' | 'organization', locale: string, key: string) {
  const found = kind === 'member' ? await readMember(key) : await readOrganization(locale, key);
  return found ?? defaultText(locale);
}

export async function resourceImageMetadata(
  format: ShareFormat,
  kind: 'member' | 'organization',
  locale: string,
  key: string,
) {
  const { title } = await shared(kind, locale, key);
  return [{ id: 'share', alt: title, size: shareImageSize(format), contentType: 'image/png' }];
}

export async function renderResourceImage(
  format: ShareFormat,
  kind: 'member' | 'organization',
  locale: string,
  key: string,
) {
  const { title, subtitle } = await shared(kind, locale, key);
  return renderShareImage(format, title, subtitle);
}
