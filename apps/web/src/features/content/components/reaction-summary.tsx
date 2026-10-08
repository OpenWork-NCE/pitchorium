import type { ReactionSummary as ReactionSummaryData } from '@pitchorium/contracts';
import { HeartHandshake, Lightbulb, type LucideIcon, PartyPopper, ThumbsUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

type ReactionType = keyof ReactionSummaryData['counts'];

/** One drawing per reaction of the professional set (§10.3), lucide only. */
export const REACTION_ICONS: Readonly<Record<ReactionType, LucideIcon>> = {
  like: ThumbsUp,
  bravo: PartyPopper,
  insightful: Lightbulb,
  support: HeartHandshake,
};

/** Reactions shown as icons: the most given ones. */
const MAIN_REACTIONS = 3;

/**
 * Summary of the reactions of a publication: the icons of the main reactions grouped, then the
 * total (« 35 réactions »); the names of the main reactions for screen readers.
 */
export function ReactionSummary({
  reactions,
  className,
}: {
  reactions: ReactionSummaryData;
  className?: string;
}) {
  const t = useTranslations('web.content');
  const names = useTranslations('reference.reactionTypes');
  const locale = useLocale();
  if (reactions.total === 0) return null;
  const main = (Object.entries(reactions.counts) as [ReactionType, number][])
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAIN_REACTIONS)
    .map(([type]) => type);
  const count = new Intl.NumberFormat(locale).format(reactions.total);
  const plural = new Intl.PluralRules(locale).select(reactions.total) === 'one' ? 'one' : 'other';
  const list = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    main.map((type) => names(type)),
  );
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span aria-hidden className="flex -space-x-1.5">
        {main.map((type) => {
          const Icon = REACTION_ICONS[type];
          return (
            <span
              key={type}
              className="inline-flex size-6 items-center justify-center rounded-full bg-accent-subtle text-on-accent-subtle ring-2 ring-surface"
            >
              <Icon className="size-4" />
            </span>
          );
        })}
      </span>
      <span className="tabular-nums">
        {t(`reactions.${plural}`, { count })}
        <span className="sr-only"> {t('mainReactions', { list })}</span>
      </span>
    </span>
  );
}
