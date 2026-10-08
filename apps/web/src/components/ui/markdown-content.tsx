import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { type Block, type Inline, parseMarkdown } from '@/lib/markdown/parse';

interface MarkdownContentProps {
  /** Restricted Markdown of the api (descriptions of projects and events, updates). */
  source: string;
  /**
   * Level of the outline the content sits under: its `##` headings become `h3` under an `h2`
   * section (2, by default), so that the outline of the page stays correct.
   */
  sectionLevel?: 1 | 2 | 3;
  className?: string;
}

/**
 * Safe rendering of the restricted Markdown of the api: React elements only, never HTML from
 * the text (`@/lib/markdown/parse`). Links go to https only, open a new tab with
 * `rel="noopener noreferrer nofollow"`, and say so.
 */
export function MarkdownContent({ source, sectionLevel = 2, className }: MarkdownContentProps) {
  const t = useTranslations('web.ui');

  function inline(nodes: readonly Inline[], prefix: string): ReactNode[] {
    return nodes.map((node, index) => {
      const key = `${prefix}-${index}`;
      switch (node.type) {
        case 'text':
          return node.value;
        case 'break':
          return <br key={key} />;
        case 'code':
          return (
            <code
              key={key}
              className="rounded-xs bg-surface-sunken px-1 py-0.5 font-mono text-[0.9em]"
            >
              {node.value}
            </code>
          );
        case 'strong':
          return (
            <strong key={key} className="font-semibold">
              {inline(node.children, key)}
            </strong>
          );
        case 'emphasis':
          return <em key={key}>{inline(node.children, key)}</em>;
        case 'link':
          return (
            <a
              key={key}
              href={node.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-xs link-underline text-link"
            >
              {inline(node.children, key)}
              <ArrowUpRight aria-hidden className="ml-0.5 inline size-[0.9em] align-[-0.1em]" />
              <span className="sr-only">{` (${t('newTab')})`}</span>
            </a>
          );
      }
    });
  }

  function blocks(nodes: readonly Block[], prefix: string): ReactNode[] {
    return nodes.map((node, index) => {
      const key = `${prefix}-${index}`;
      switch (node.type) {
        case 'paragraph':
          return <p key={key}>{inline(node.children, key)}</p>;
        case 'heading': {
          const level = Math.min(6, sectionLevel + node.level - 1);
          const Tag = `h${level}` as 'h3';
          return (
            <Tag
              key={key}
              className={cn('font-sans font-semibold', node.level === 2 ? 'text-xl' : 'text-lg')}
            >
              {inline(node.children, key)}
            </Tag>
          );
        }
        case 'rule':
          return <hr key={key} className="border-border" />;
        case 'quote':
          return (
            <blockquote key={key} className="border-l-2 border-accent pl-4 text-muted">
              {blocks(node.children, key)}
            </blockquote>
          );
        case 'list': {
          const items = node.items.map((item, itemIndex) => (
            // The items of a parsed text keep their order.
            <li key={`${key}-${itemIndex}`} className="pl-1 [&>p]:inline">
              {blocks(item, `${key}-${itemIndex}`)}
            </li>
          ));
          return node.ordered ? (
            <ol
              key={key}
              start={node.start}
              className="grid list-decimal gap-1 pl-6 marker:text-muted"
            >
              {items}
            </ol>
          ) : (
            <ul key={key} className="grid list-disc gap-1 pl-6 marker:text-muted">
              {items}
            </ul>
          );
        }
      }
    });
  }

  return (
    <div
      className={cn('grid max-w-[68ch] gap-4 text-base leading-relaxed text-foreground', className)}
    >
      {blocks(parseMarkdown(source), 'md')}
    </div>
  );
}
