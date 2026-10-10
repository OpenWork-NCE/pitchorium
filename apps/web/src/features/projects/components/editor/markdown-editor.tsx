'use client';

import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useRef, useState } from 'react';
import { IconButton, MarkdownContent, Tabs, TabsPanel, Textarea } from '@/components/ui';

type Action = 'h2' | 'h3' | 'bold' | 'italic' | 'list' | 'ordered' | 'quote' | 'link';

/** What an action writes around the selection (inline) or at the start of its lines (block). */
const SYNTAX: Record<
  Action,
  { kind: 'wrap'; before: string; after: string } | { kind: 'line'; prefix: string }
> = {
  h2: { kind: 'line', prefix: '## ' },
  h3: { kind: 'line', prefix: '### ' },
  bold: { kind: 'wrap', before: '**', after: '**' },
  italic: { kind: 'wrap', before: '*', after: '*' },
  list: { kind: 'line', prefix: '- ' },
  ordered: { kind: 'line', prefix: '1. ' },
  quote: { kind: 'line', prefix: '> ' },
  link: { kind: 'wrap', before: '[', after: '](https://)' },
};

const ICONS = {
  h2: <Heading2 />,
  h3: <Heading3 />,
  bold: <Bold />,
  italic: <Italic />,
  list: <List />,
  ordered: <ListOrdered />,
  quote: <Quote />,
  link: <Link2 />,
};

/** Applies an action to a text and its selection; returns the new text and selection. */
export function applyMarkdown(
  text: string,
  start: number,
  end: number,
  action: Action,
): { text: string; start: number; end: number } {
  const syntax = SYNTAX[action];
  if (syntax.kind === 'wrap') {
    const selected = text.slice(start, end);
    const next = `${text.slice(0, start)}${syntax.before}${selected}${syntax.after}${text.slice(end)}`;
    return { text: next, start: start + syntax.before.length, end: end + syntax.before.length };
  }
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const block = text.slice(lineStart, end);
  const prefixed = block
    .split('\n')
    .map((line) => `${syntax.prefix}${line}`)
    .join('\n');
  const next = `${text.slice(0, lineStart)}${prefixed}${text.slice(end)}`;
  return { text: next, start: lineStart, end: lineStart + prefixed.length };
}

/**
 * Editor of the restricted Markdown of the api (§11.1): the text, a toolbar for its few forms
 * (headings of level 2 and 3, emphasis, lists, quotes, https links), and a preview rendered by the
 * component of the page itself, so that what is read here is what the page shows.
 */
export default function MarkdownEditor({
  value,
  onChange,
  onBlur,
  ...props
}: Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('web.projects.editor.markdown');
  const area = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const apply = (action: Action) => {
    const element = area.current;
    if (!element) return;
    const result = applyMarkdown(value, element.selectionStart, element.selectionEnd, action);
    onChange(result.text);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(result.start, result.end);
    });
  };
  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      label={t('tabs')}
      tabs={[
        { value: 'write', label: t('write') },
        { value: 'preview', label: t('preview') },
      ]}
    >
      <TabsPanel value="write" className="grid gap-2 pt-3">
        <div role="toolbar" aria-label={t('toolbar')} className="flex flex-wrap gap-1">
          {(Object.keys(SYNTAX) as Action[]).map((action) => (
            <IconButton
              key={action}
              type="button"
              size="sm"
              label={t(`actions.${action}`)}
              icon={ICONS[action]}
              onClick={() => apply(action)}
            />
          ))}
        </div>
        <Textarea
          {...props}
          ref={area}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          rows={16}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted">{t('help')}</p>
      </TabsPanel>
      <TabsPanel value="preview" className="pt-3">
        {value.trim() ? (
          <MarkdownContent source={value} sectionLevel={2} />
        ) : (
          <p className="text-sm text-muted">{t('empty')}</p>
        )}
      </TabsPanel>
    </Tabs>
  );
}
