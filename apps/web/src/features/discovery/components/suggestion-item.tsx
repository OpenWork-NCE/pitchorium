import type { DiscoveryCard } from '@pitchorium/contracts';
import { Avatar } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

type PersonCard = Extract<DiscoveryCard, { kind: 'person' }>;

interface SuggestionItemProps {
  /** The person suggested (discovery module, ADR 0067). */
  person: PersonCard;
  /** Reason sentence, built by the server (`suggestionSentenceText`, §11.4). */
  reason: string;
  className?: string;
}

/**
 * A person suggested, with the reason why (§11.4: « Suggéré parce que… »). The reason shows on
 * two lines at least, three at most, and whole while the pointer is over the suggestion or the
 * focus in it; it is never cut to one line, and the whole text stays in the page.
 */
export function SuggestionItem({ person, reason, className }: SuggestionItemProps) {
  return (
    <li className={cn('group flex items-start gap-3', className)}>
      <Avatar name={person.title} src={person.imageUrl} size="sm" decorative />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Link
          href={routes.member(person.key)}
          className="w-fit max-w-full truncate rounded-xs text-sm font-semibold outline-none hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {person.title}
        </Link>
        {person.subtitle ? <p className="truncate text-xs text-muted">{person.subtitle}</p> : null}
        <p className="line-clamp-3 text-xs text-pretty text-muted group-focus-within:line-clamp-none group-hover:line-clamp-none">
          {reason}
        </p>
      </div>
    </li>
  );
}
