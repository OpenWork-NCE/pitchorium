import type { Mention } from '@pitchorium/contracts';
import { Truncate } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { textSegments } from '../../lib/post-text';

/**
 * The text of a publication: kept as written (lines), the resolved mentions linked to their page,
 * the addresses to outside (`ugc`: written by a member, never endorsed), cut after a few lines
 * with « voir plus » (`full` on the page of the publication).
 */
export function PostText({
  text,
  mentions,
  full = false,
}: {
  text: string;
  mentions: readonly Mention[];
  full?: boolean;
}) {
  const body = (
    <p className="text-pretty break-words whitespace-pre-line">
      {textSegments(text, mentions).map((segment, index) => {
        if (segment.kind === 'mention') {
          const { mention } = segment;
          return (
            <Link
              key={index}
              href={
                mention.type === 'member'
                  ? routes.member(mention.key)
                  : routes.organization(mention.key)
              }
              prefetch={false}
              className="font-medium text-link hover:underline"
            >
              {mention.displayName}
            </Link>
          );
        }
        if (segment.kind === 'link') {
          return (
            <a
              key={index}
              href={segment.href}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="break-all text-link underline underline-offset-2"
            >
              {segment.text}
            </a>
          );
        }
        return segment.text;
      })}
    </p>
  );
  return full ? body : <Truncate lines={6}>{body}</Truncate>;
}
