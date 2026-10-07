export interface OpenGraphPreview {
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
}

const LIMITS = { title: 300, description: 500, siteName: 100 };

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
}

function clean(value: string | undefined, max: number): string | null {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Attributes of every `<meta>` tag, whatever their order and quotes. */
function metaTags(html: string): Record<string, string>[] {
  const tags: Record<string, string>[] = [];
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(/([a-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
      const name = match[1]?.toLowerCase();
      if (name) attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    tags.push(attributes);
  }
  return tags;
}

/**
 * Preview of a page from its Open Graph tags, with `<title>` and the description meta tag as
 * fallbacks. Only the head is read; the image URL is resolved against the final URL and kept
 * only when it is http or https.
 */
export function parseOpenGraph(html: string, pageUrl: string): OpenGraphPreview {
  const head = html.slice(0, html.search(/<\/head>/i) === -1 ? 200_000 : html.search(/<\/head>/i));
  const meta = new Map<string, string>();
  for (const tag of metaTags(head)) {
    const key = (tag['property'] ?? tag['name'] ?? '').toLowerCase();
    const content = tag['content'];
    if (key && content !== undefined && !meta.has(key)) meta.set(key, content);
  }
  const title = meta.get('og:title') ?? /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1];
  let imageUrl: string | null = null;
  const image = meta.get('og:image:secure_url') ?? meta.get('og:image');
  if (image) {
    try {
      const resolved = new URL(decodeEntities(image.trim()), pageUrl);
      if (resolved.protocol === 'https:' || resolved.protocol === 'http:') {
        imageUrl = resolved.toString();
      }
    } catch {
      imageUrl = null;
    }
  }
  return {
    title: clean(title, LIMITS.title),
    description: clean(meta.get('og:description') ?? meta.get('description'), LIMITS.description),
    siteName: clean(meta.get('og:site_name'), LIMITS.siteName),
    imageUrl,
  };
}
