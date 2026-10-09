import type { DiscoveryCard } from '@pitchorium/contracts';
import type { ReactNode } from 'react';
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
  /** « Se connecter » and « Pas intéressé » (SuggestionActions). */
  actions?: ReactNode;
  className?: string;
}

/**
 * A person suggested, with the reason why (§11.4), neutral and without repeating the name above
 * it (« Propose du mentorat · secteur commun : Énergie »), then its actions. The reason shows on
 * two lines at least, three at most, and whole while the pointer is over the suggestion or the
 * focus in it; it is never cut to one line, and the whole text stays in the page.
 */
export function SuggestionItem({ person, reason, actions, className }: SuggestionItemProps) {
  return (
    <li className={cn('group flex items-start gap-3', className)}>
      <Avatar name={person.title} src={person.imageUrl} size="sm" decorative />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Link
          href={routes.member(person.key)}
          prefetch={false}
          className="w-fit max-w-full truncate rounded-xs text-sm font-semibold outline-none hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {person.title}
        </Link>
        {person.subtitle ? <p className="truncate text-xs text-muted">{person.subtitle}</p> : null}
        <p className="line-clamp-3 text-xs text-pretty text-muted group-focus-within:line-clamp-none group-hover:line-clamp-none">
          {reason}
        </p>
        {actions ? <div className="pt-1.5">{actions}</div> : null}
      </div>
    </li>
  );
}
