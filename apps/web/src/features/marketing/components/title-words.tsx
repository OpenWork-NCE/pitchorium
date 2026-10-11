import type { CSSProperties } from 'react';

/**
 * A page title split into words on the server (H13, CSS only, class `title-reveal` on the
 * heading): each word rises from its mask, 40 ms after the previous one, painted from the first
 * render; immobile with less motion.
 */
export function TitleWords({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((word, index) => (
    <span key={index}>
      {/* A word never breaks inside, « Afrique–Diaspora » included. */}
      <span className="title-word whitespace-nowrap">
        <span style={{ '--word': index } as CSSProperties}>{word}</span>
      </span>
      {index < words.length - 1 ? ' ' : null}
    </span>
  ));
}
