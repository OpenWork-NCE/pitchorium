import 'server-only';
import {
  organizationsControllerForPublic,
  postsControllerGetPublic,
  profilesControllerForPublic,
  projectsControllerForPublic,
} from '@pitchorium/api-client';
import { createTranslator } from 'next-intl';
import { cache } from 'react';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { formatMoney } from '@/lib/format/money';
import { messagesFor } from '@/lib/i18n/messages';
import {
  type ProjectShare,
  renderProjectShareImage,
  renderShareImage,
  type ShareFormat,
  shareImageSize,
} from './share-image';

/**
 * Share images of the public pages of members, organisations and publications (ADR 0101): read
 * from their public view only, so that a page closed to visitors shares the default image of the
 * locale and nothing of its content.
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

const readPost = cache(async (locale: string, id: string): Promise<Shared | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  configureServerApi();
  const post = await postsControllerGetPublic(id).catch(() => null);
  if (!post) return null;
  const lang = asLocale(locale);
  // The messages are typed loosely here (a tree): the parameter of the title is given as is.
  const t = createTranslator({
    locale: lang,
    messages: messagesFor(lang),
    namespace: 'web.post',
  }) as unknown as (key: 'title', values: { name: string }) => string;
  const name =
    post.author.type === 'member' ? post.author.member.displayName : post.author.organization.name;
  const text = post.text?.replace(/\s+/g, ' ').trim() ?? '';
  return {
    title: t('title', { name }),
    subtitle: text ? (text.length > 140 ? `${text.slice(0, 137)}…` : text) : null,
  };
});

type SharedKind = 'member' | 'organization' | 'post';

async function shared(kind: SharedKind, locale: string, key: string) {
  const found =
    kind === 'member'
      ? await readMember(key)
      : kind === 'organization'
        ? await readOrganization(locale, key)
        : await readPost(locale, key);
  return found ?? defaultText(locale);
}

export async function resourceImageMetadata(
  format: ShareFormat,
  kind: SharedKind,
  locale: string,
  key: string,
) {
  const { title } = await shared(kind, locale, key);
  return [{ id: 'share', alt: title, size: shareImageSize(format), contentType: 'image/png' }];
}

export async function renderResourceImage(
  format: ShareFormat,
  kind: SharedKind,
  locale: string,
  key: string,
) {
  const { title, subtitle } = await shared(kind, locale, key);
  return renderShareImage(format, title, subtitle);
}

/** A project in its public view only: a draft or a hidden project shares the default image. */
const readProject = cache(async (locale: string, slug: string): Promise<ProjectShare | null> => {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  configureServerApi();
  const project = await projectsControllerForPublic(slug).catch(() => null);
  if (!project) return null;
  const lang = asLocale(locale);
  const t = createTranslator({
    locale: lang,
    messages: messagesFor(lang),
    namespace: 'web.projects.shareImage',
  }) as unknown as (key: 'funding', values: Record<string, string | number>) => string;
  const { goal, collected, progressPercent } = project.funding;
  return {
    title: project.title,
    imageUrl: project.gallery[0]?.url ?? null,
    progress: goal ? progressPercent / 100 : null,
    fundingText: goal
      ? t('funding', {
          collected: formatMoney(collected, lang),
          goal: formatMoney(goal, lang),
          percent: progressPercent,
        })
      : null,
  };
});

export async function projectImageMetadata(format: ShareFormat, locale: string, slug: string) {
  const project = await readProject(locale, slug);
  const { title } = project ?? defaultText(locale);
  return [{ id: 'share', alt: title, size: shareImageSize(format), contentType: 'image/png' }];
}

export async function renderProjectImage(format: ShareFormat, locale: string, slug: string) {
  const project = await readProject(locale, slug);
  if (!project) {
    const { title, subtitle } = defaultText(locale);
    return renderShareImage(format, title, subtitle);
  }
  return renderProjectShareImage(format, project);
}
