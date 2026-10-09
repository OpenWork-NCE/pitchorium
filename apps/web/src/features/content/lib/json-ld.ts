import type { Post } from '@pitchorium/contracts';
import type { SocialMediaPosting, WithContext } from 'schema-dts';

/** The name of the author of a publication: a member or an organization. */
export function postAuthorName(post: Pick<Post, 'author'>): string {
  return post.author.type === 'member'
    ? post.author.member.displayName
    : post.author.organization.name;
}

/**
 * Structured data of a public publication (JSON-LD `SocialMediaPosting`): only what its page shows
 * to everyone, its author, its text, its dates, its images and its counters of interactions.
 */
export function socialMediaPostingJsonLd(post: Post, url: string): WithContext<SocialMediaPosting> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    url,
    datePublished: post.createdAt,
    ...(post.editedAt ? { dateModified: post.editedAt } : {}),
    ...(post.text ? { articleBody: post.text } : {}),
    ...(post.language ? { inLanguage: post.language } : {}),
    author:
      post.author.type === 'member'
        ? { '@type': 'Person', name: post.author.member.displayName }
        : { '@type': 'Organization', name: post.author.organization.name },
    ...(post.images.length ? { image: post.images.map((image) => image.url) } : {}),
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'LikeAction' },
        userInteractionCount: post.reactions.total,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'CommentAction' },
        userInteractionCount: post.commentCount,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'ShareAction' },
        userInteractionCount: post.repostCount,
      },
    ],
  };
}
