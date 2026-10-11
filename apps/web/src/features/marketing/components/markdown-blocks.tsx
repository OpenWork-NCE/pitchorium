import type { Block, Inline } from '../lib/markdown';

function InlineText({ content }: { content: readonly Inline[] }) {
  return content.map((part, index) => {
    if (part.type === 'strong') return <strong key={index}>{part.text}</strong>;
    if (part.type === 'em') return <em key={index}>{part.text}</em>;
    if (part.type === 'code') {
      return (
        <code key={index} className="rounded-sm bg-surface-sunken px-1 font-mono text-sm">
          {part.text}
        </code>
      );
    }
    return part.text;
  });
}

/** The blocks of a legal Markdown file, as plain elements (no injected HTML). */
export function MarkdownBlocks({ blocks }: { blocks: readonly Block[] }) {
  return blocks.map((block, index) => {
    if (block.type === 'heading') {
      const Tag = block.level === 2 ? 'h2' : 'h3';
      return (
        <Tag
          key={index}
          id={block.id}
          className={
            block.level === 2
              ? 'mt-12 scroll-mt-24 font-display text-2xl font-extrabold text-balance'
              : 'mt-8 scroll-mt-24 text-lg font-semibold'
          }
        >
          {block.text}
        </Tag>
      );
    }
    if (block.type === 'list') {
      return (
        <ul key={index} className="mt-4 grid list-disc gap-2 pl-6">
          {block.items.map((item, position) => (
            <li key={position}>
              <InlineText content={item} />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={index} className="mt-4">
        <InlineText content={block.content} />
      </p>
    );
  });
}
