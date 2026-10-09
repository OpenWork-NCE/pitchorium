import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Link } from '@/components/ui';
import { routes } from '@/config/routes';
import { siteConfig } from '@/config/site';
import {
  LazyMemberPost,
  PostCard,
  postAuthorName,
  socialMediaPostingJsonLd,
} from '@/features/content';
import { asLocale } from '@/i18n/routing';
import { resourceMetadata } from '@/lib/resources/metadata';
import { jsonLd } from '@/lib/seo/json-ld';
import { readPost } from './read-post';

/** The start of the text, for the description of the page and of its share image. */
function excerpt(text: string | null): string | undefined {
  if (!text) return undefined;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}…` : flat;
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/posts/[postId]'>): Promise<Metadata> {
  const { locale, postId } = await params;
  const resource = await readPost(postId);
  const t = await getTranslations('web.post');
  const title = resource ? t('title', { name: postAuthorName(resource.data) }) : undefined;
  const metadata = await resourceMetadata(asLocale(locale), routes.post(postId), resource, title);
  const description = excerpt(resource?.data.text ?? null);
  return description ? { ...metadata, description } : metadata;
}

/**
 * A publication at its own address (§10.3, ADR 0101): its public view, indexable with its
 * structured data, when it is public; the member view otherwise, never indexed; 404 for a reader
 * who may not see it. Its comments are open.
 */
export default async function Page({ params }: PageProps<'/[locale]/posts/[postId]'>) {
  const { locale: raw, postId } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const resource = await readPost(postId);
  if (!resource) notFound();
  const post = resource.data;
  const t = await getTranslations('web.post');
  const address = new URL(`/${locale}${routes.post(post.id)}`, siteConfig.url).toString();
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-4">
        <Heading level={1} size="page" className="sr-only">
          {t('title', { name: postAuthorName(post) })}
        </Heading>
        {resource.view === 'member' ? (
          <>
            <Link href={routes.feed} variant="standalone" className="text-sm">
              {t('backToFeed')}
            </Link>
            <LazyMemberPost post={post} full commentsOpen />
          </>
        ) : (
          <>
            <PostCard
              post={post}
              signedIn={false}
              full
              returnTo={`/${locale}${routes.post(post.id)}`}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLd(socialMediaPostingJsonLd(post, address)) }}
            />
          </>
        )}
      </div>
    </SingleColumnLayout>
  );
}
