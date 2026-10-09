'use client';

import { discoveryControllerAutocomplete } from '@pitchorium/api-client';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { documentNonce } from '@/lib/security/document-nonce';
import type { EditorNode } from '../../lib/mention-text';
import { firstUrl } from '../../lib/post-text';
import { MentionList } from '../mentions/mention-list';
import type { MentionOption } from '../mentions/use-mention-search';

interface SuggestionState {
  items: MentionOption[];
  active: number;
  /** Where the list goes, under the `@`, in the frame of the editor. */
  position: { top: number; left: number } | null;
  command: ((attrs: { id: string; label: string; kind: string }) => void) | null;
}

const CLOSED: SuggestionState = { items: [], active: 0, position: null, command: null };

/**
 * The text of a publication (ADR 0119, Tiptap): paragraphs and line breaks, addresses turned
 * into links as they are typed or pasted, mentions of members and organizations by `@` (from
 * the search of the api: arrows, Enter or Tab, Escape, or the mouse). A pasted address asks
 * for its preview (`onPasteUrl`). The document goes to `onChange` at every change.
 */
export function Editor({
  initial,
  label,
  describedBy,
  onChange,
  onPasteUrl,
}: {
  initial: EditorNode | null;
  label: string;
  describedBy?: string;
  onChange: (document: EditorNode) => void;
  onPasteUrl: (url: string) => void;
}) {
  const t = useTranslations('web.composer');
  const listId = useId();
  const [suggestion, setSuggestion] = useState<SuggestionState>(CLOSED);
  // The keys of the editor read the list as it is now (Tiptap keeps the first callbacks).
  const state = useRef(suggestion);
  useEffect(() => {
    state.current = suggestion;
  }, [suggestion]);
  const container = useRef<HTMLDivElement>(null);
  const place = (rect: DOMRect | null | undefined) => {
    const box = container.current?.getBoundingClientRect();
    return rect && box
      ? { top: rect.bottom - box.top + 4, left: Math.max(0, rect.left - box.left) }
      : null;
  };

  const editor = useEditor({
    immediatelyRender: false,
    // The base styles Tiptap inserts carry the nonce of the policy (ADR 0088).
    injectNonce: documentNonce(),
    content: initial ?? undefined,
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      UndoRedo,
      Placeholder.configure({ placeholder: t('placeholder') }),
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        protocols: ['https', 'http'],
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer nofollow ugc', target: null },
      }),
      Mention.extend({
        addAttributes() {
          return {
            ...(this.parent?.() as Record<string, unknown>),
            kind: { default: 'member' },
          };
        },
      }).configure({
        HTMLAttributes: { class: 'mention' },
        renderText: ({ node }) => `@${String(node.attrs['id'])}`,
        renderHTML: ({ options, node }) => [
          'span',
          { ...options.HTMLAttributes, 'data-key': String(node.attrs['id']) },
          `@${String(node.attrs['label'] ?? node.attrs['id'])}`,
        ],
        suggestion: {
          char: '@',
          allowSpaces: false,
          items: async ({ query }) => {
            if (!query) return [];
            try {
              const result = await discoveryControllerAutocomplete({
                q: query,
                kinds: 'person,organization',
                limit: 6,
              });
              return result.items.flatMap((item): MentionOption[] =>
                item.kind === 'person' || item.kind === 'organization'
                  ? [
                      {
                        kind: item.kind === 'person' ? 'member' : 'organization',
                        key: item.key,
                        label: item.title,
                        subtitle: item.subtitle,
                      },
                    ]
                  : [],
              );
            } catch {
              return [];
            }
          },
          command: ({ editor: current, range, props }) => {
            current
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: 'mention', attrs: props as unknown as Record<string, unknown> },
                { type: 'text', text: ' ' },
              ])
              .run();
          },
          render: () => ({
            onStart: (props: SuggestionProps<MentionOption>) =>
              setSuggestion({
                items: props.items,
                active: 0,
                position: place(props.clientRect?.()),
                command: (attrs) => props.command(attrs),
              }),
            onUpdate: (props: SuggestionProps<MentionOption>) =>
              setSuggestion((current) => ({
                items: props.items,
                active: Math.min(current.active, Math.max(0, props.items.length - 1)),
                position: place(props.clientRect?.()),
                command: (attrs) => props.command(attrs),
              })),
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
              const current = state.current;
              if (event.key === 'Escape') {
                setSuggestion(CLOSED);
                return true;
              }
              if (current.items.length === 0) return false;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                const step = event.key === 'ArrowDown' ? 1 : -1;
                setSuggestion({
                  ...current,
                  active: (current.active + step + current.items.length) % current.items.length,
                });
                return true;
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                const option = current.items[current.active];
                if (option)
                  current.command?.({ id: option.key, label: option.label, kind: option.kind });
                return true;
              }
              return false;
            },
            onExit: () => setSuggestion(CLOSED),
          }),
        },
      }),
    ],
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class:
          'min-h-32 max-h-[40dvh] overflow-y-auto rounded-md px-1 py-2 text-base leading-normal outline-none [&_.mention]:font-medium [&_.mention]:text-link [&_a]:text-link [&_a]:underline [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
      },
      handlePaste: (_view, event) => {
        const url = firstUrl(event.clipboardData?.getData('text/plain') ?? '');
        if (url) onPasteUrl(url);
        return false;
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as EditorNode),
  });

  // The list of mentions exists only while it is open: the editor points to it then only.
  const listOpen = suggestion.position !== null;
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    if (listOpen) dom.setAttribute('aria-controls', listId);
    else dom.removeAttribute('aria-controls');
  }, [editor, listOpen, listId]);

  return (
    <div ref={container} className="relative">
      <EditorContent editor={editor} />
      {suggestion.position ? (
        <div className="absolute z-(--z-overlay)" style={suggestion.position}>
          <MentionList
            id={listId}
            options={suggestion.items}
            active={suggestion.active}
            loading={false}
            onHover={(active) => setSuggestion((current) => ({ ...current, active }))}
            onPick={(option) =>
              suggestion.command?.({ id: option.key, label: option.label, kind: option.kind })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
