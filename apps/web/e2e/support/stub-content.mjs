// Content of the stub api (PROMPT FRONT 4): the feed in all its variants, a publication, its
// comments and who reacted, the saved ones, the activity of a member, the previews of links, the
// suggestions of mentions, and the images of the publications, drawn here as PNG files. Every
// write is logged (`/__test/writes`); `/__test/newer` sets the count of newer publications.
import { deflateSync } from 'node:zlib';

const ID = (n) => `0192f4a0-2000-7000-8000-${String(n).padStart(12, '0')}`;
const COMMENT_ID = (n) => `0192f4a0-3000-7000-8000-${String(n).padStart(12, '0')}`;

/** A PNG of the given size and color, with a soft gradient (no dependency, zlib only). */
function png(width, height, [r, g, b]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      const shade = 0.75 + (0.25 * (x + y)) / (width + height);
      raw[offset] = Math.round(r * shade);
      raw[offset + 1] = Math.round(g * shade);
      raw[offset + 2] = Math.round(b * shade);
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Colors of the brand family for the images of the stub (no person, no generic stock). */
const COLORS = [
  [62, 40, 93],
  [202, 135, 100],
  [30, 122, 76],
  [36, 87, 166],
  [143, 84, 6],
  [94, 91, 86],
  [184, 169, 211],
  [234, 228, 242],
  [18, 18, 18],
];
const IMAGES = new Map();
function imageFile(name) {
  if (!IMAGES.has(name)) {
    const index = Number(/\d+/.exec(name)?.[0] ?? 0) % COLORS.length;
    const [width, height] = name.includes('portrait') ? [480, 600] : [640, 400];
    IMAGES.set(name, png(width, height, COLORS[index]));
  }
  return IMAGES.get(name);
}

/** The images of a publication, with their text alternatives (or none, to see it asked for). */
function images(origin, count, withAlt = true) {
  return Array.from({ length: count }, (_, index) => {
    const url = `${origin}/files/post-${index}.png`;
    return {
      mediaId: ID(9000 + index),
      url,
      variants: {
        large: { width: 640, height: 400, webp: url, avif: null },
        medium: { width: 640, height: 400, webp: url, avif: null },
      },
      alt: withAlt ? `Parcelle maraîchère ${index + 1}, irriguée par la pompe solaire` : null,
    };
  });
}

const reactions = (like, viewerReaction = null) => ({
  counts: { like, bravo: Math.floor(like / 3), insightful: 2, support: 1 },
  total: like + Math.floor(like / 3) + 3,
  viewerReaction,
});

function post(origin, n, author, fields = {}) {
  return {
    id: ID(n),
    author: { type: 'member', member: author },
    text: `Publication ${n} de ${author.displayName} : un retour d’expérience de terrain.`,
    language: 'fr',
    languageSource: 'detected',
    visibility: 'members',
    images: [],
    document: null,
    link: null,
    mentions: [],
    projectId: null,
    commentsDisabled: false,
    reactions: reactions(12),
    commentCount: 3,
    repostCount: 0,
    saved: false,
    viewerIsAuthor: false,
    featured: false,
    moderation: 'visible',
    // Relative to now: « il y a 1 heure » whatever the day (reference screenshots).
    createdAt: new Date(Date.now() - n * 3_600_000).toISOString(),
    editedAt: null,
    kind: 'post',
    repostOf: null,
    ...fields,
  };
}

const LONG_TEXT = [
  'Six mois après l’installation de la pompe solaire, la coopérative arrose deux fois plus de parcelles avec la même eau.',
  'Ce qui a marché : former deux techniciennes du village, garder un stock de pièces à Thiès, tenir un carnet partagé des pannes.',
  'Ce qui reste difficile : le financement du stockage, et le transport des récoltes pendant la saison des pluies.',
  'Merci à @kofi-mensah pour ses conseils sur le plan de trésorerie, et à toutes celles qui ont relu ce bilan.',
].join('\n\n');

/** The feed of the stub: every variant the web draws, and one type it does not know. */
export function feedItems(origin, authors, viewer) {
  const [kofi, nadia, moussa] = authors;
  const items = [];
  const push = (type, value) => items.push({ type, id: `${type}:${value.id}`, post: value });
  push(
    'post',
    post(origin, 1, kofi, {
      text: LONG_TEXT,
      mentions: [
        { token: '@kofi-mensah', type: 'member', key: 'kofi-mensah', displayName: 'Kofi Mensah' },
      ],
      images: images(origin, 1),
      editedAt: new Date(Date.now() - 1_800_000).toISOString(),
    }),
  );
  push(
    'post',
    post(origin, 2, nadia, {
      text: 'Court et clair : nous recrutons une mentore finance.',
      images: images(origin, 2),
    }),
  );
  push('post', post(origin, 3, moussa, { images: images(origin, 3) }));
  push('post', post(origin, 4, kofi, { images: images(origin, 5, false), visibility: 'public' }));
  push(
    'post',
    post(origin, 5, nadia, {
      text: 'Notre pitch deck, avant la levée de fonds.',
      document: {
        mediaId: ID(9100),
        thumbnailUrl: `${origin}/files/document-portrait-1.png`,
        pageCount: 12,
        title: 'Pitch deck Sahel Agri 2026',
      },
    }),
  );
  push(
    'post',
    post(origin, 6, moussa, {
      text: 'À lire sur l’irrigation solaire : https://sahel.example/irrigation',
      link: {
        url: 'https://sahel.example/irrigation',
        status: 'ready',
        title: 'Irrigation solaire à Thiès',
        description: 'Une coopérative de 40 maraîchères arrose ses parcelles au soleil.',
        siteName: 'Sahel Agri',
        imageUrl: `${origin}/files/link-3.png`,
      },
    }),
  );
  const original = post(origin, 7, kofi, {
    visibility: 'public',
    text: 'Le rapport annuel est en ligne.',
  });
  push(
    'repost',
    post(origin, 8, nadia, {
      kind: 'repost',
      text: 'À lire absolument, surtout la partie sur le stockage.',
      repostOf: original,
    }),
  );
  push(
    'featured',
    post(origin, 9, moussa, {
      featured: true,
      visibility: 'public',
      text: 'Sélection de la rédaction : trois projets agricoles à suivre.',
    }),
  );
  items.push({
    type: 'project_update',
    id: `project_update:${ID(9200)}`,
    update: {
      id: ID(9200),
      projectId: ID(9300),
      author: kofi,
      text: 'Premier palier atteint : la pompe est commandée.',
      images: [],
      publishedAt: new Date(Date.now() - 10 * 3_600_000).toISOString(),
      editedAt: null,
      project: {
        id: ID(9300),
        slug: 'ferme-solaire-thies',
        title: 'Ferme solaire coopérative de Thiès',
        coverImageUrl: null,
      },
    },
  });
  // A type the web does not know: left out, never an error on screen.
  items.push({ type: 'hologram', id: 'hologram:1' });
  push(
    'post',
    post(origin, 11, viewer, {
      viewerIsAuthor: true,
      moderation: 'hidden',
      text: 'Une publication que la modération a masquée.',
    }),
  );
  for (let n = 12; n <= 20; n += 1) {
    push(
      'post',
      post(origin, n, authors[n % authors.length], {
        reactions: reactions(n),
        commentCount: n % 4,
      }),
    );
  }
  return items;
}

function comment(n, author, fields = {}) {
  return {
    id: COMMENT_ID(n),
    postId: ID(1),
    parentId: null,
    author,
    text: `Commentaire ${n} : merci pour ce retour.`,
    mentions: [],
    reactions: reactions(n % 5),
    replyCount: 0,
    viewerIsAuthor: false,
    viewerCanDelete: false,
    createdAt: new Date(Date.now() - (60 - n) * 60_000).toISOString(),
    editedAt: null,
    ...fields,
  };
}

/**
 * The content routes, given the helpers of the stub. Returns null for a path it does not serve.
 */
export function contentRoutes({ origin, authors, accounts, sessionOf, problem, readJson, state }) {
  const viewerCard = (email) => {
    const account = accounts[email];
    return {
      handle: account.handle,
      displayName: account.name,
      headline: account.headline,
      avatarUrl: null,
    };
  };
  const feedOf = (email) => {
    state().feeds ??= new Map();
    if (!state().feeds.has(email))
      state().feeds.set(email, feedItems(origin, authors, viewerCard(email)));
    return state().feeds.get(email);
  };
  const postsOf = (email) =>
    feedOf(email).flatMap((item) =>
      item.post ? [item.post, ...(item.post.repostOf ? [item.post.repostOf] : [])] : [],
    );
  const log = (route, email, extra = {}) =>
    state().writes.push({ route, email, ...extra, at: new Date().toISOString() });

  return async function content(request, path) {
    const method = request.method;
    const file = /^\/files\/([\w.-]+\.png)$/.exec(path);
    if (file && method === 'GET') {
      return {
        status: 200,
        raw: imageFile(file[1]),
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      };
    }
    if (method === 'GET' && path === '/v1/public/posts/' + ID(4)) {
      return {
        status: 200,
        body: feedItems(origin, authors, authors[0])[3].post,
        headers: { 'cache-control': 'public, max-age=60' },
      };
    }
    const publicPost = /^\/v1\/public\/posts\/([\w-]+)$/.exec(path);
    if (publicPost && method === 'GET') return problem(404, 'CONTENT_POST_NOT_FOUND');
    const publicActivity = /^\/v1\/public\/(members|organizations)\/([\w-]+)\/posts$/.exec(path);
    if (publicActivity && method === 'GET') {
      const items = feedItems(origin, authors, authors[0]).flatMap((item) =>
        item.post?.visibility === 'public' ? [item.post] : [],
      );
      return { status: 200, body: { items: items.slice(0, 2), nextCursor: null } };
    }

    const email = sessionOf(request);
    const isContent =
      path.startsWith('/v1/feed') ||
      path.startsWith('/v1/posts') ||
      path.startsWith('/v1/comments') ||
      path.startsWith('/v1/link-previews') ||
      path === '/v1/me/saved-posts' ||
      path === '/v1/me/projects' ||
      path === '/v1/discovery/autocomplete' ||
      /^\/v1\/(members\/[\w-]+|organizations\/by-slug\/[\w-]+)\/posts$/.test(path);
    if (!isContent) return null;
    if (!email) return problem(401, 'UNAUTHENTICATED');

    if (method === 'GET' && path === '/v1/feed') {
      const cursor = new URL(request.url, 'http://stub').searchParams.get('cursor');
      const items = feedOf(email);
      // Two pages: the feed reads the second as the reader nears the end of the first.
      return cursor
        ? {
            status: 200,
            body: { schemaVersion: 1, items: items.slice(12), nextCursor: null, head: null },
          }
        : {
            status: 200,
            body: {
              schemaVersion: 1,
              items: items.slice(0, 12),
              nextCursor: 'page-2',
              head: 'stub-head',
            },
          };
    }
    if (method === 'GET' && path === '/v1/feed/newer') {
      return { status: 200, body: { count: state().newer ?? 0, capped: false } };
    }
    if (method === 'POST' && path === '/v1/posts/views') {
      const { postIds } = await readJson(request);
      log('views', email, { postIds });
      return { status: 204, body: null };
    }
    if (method === 'POST' && path === '/v1/posts') {
      const body = await readJson(request);
      log('post', email, { body });
      const created = post(origin, 0, viewerCard(email), {
        id: ID(8000 + state().writes.length),
        text: body.text ?? null,
        visibility: body.visibility ?? 'members',
        images: (body.images ?? []).map((image, index) => ({
          ...images(origin, 1)[0],
          mediaId: image.mediaId,
          alt: image.alt ?? null,
          url: `${origin}/files/post-${index}.png`,
        })),
        reactions: reactions(0),
        commentCount: 0,
        viewerIsAuthor: true,
        createdAt: new Date().toISOString(),
      });
      return { status: 201, body: created };
    }
    if (method === 'GET' && path === '/v1/me/saved-posts') {
      const saved = postsOf(email).filter(
        (item) => item.saved || (state().saved ?? new Set()).has(item.id),
      );
      return {
        status: 200,
        body: {
          items: saved.map((item) => ({
            savedAt: new Date().toISOString(),
            post: { ...item, saved: true },
          })),
          nextCursor: null,
        },
      };
    }
    if (method === 'GET' && path === '/v1/me/projects') return { status: 200, body: { items: [] } };
    if (method === 'GET' && path === '/v1/discovery/autocomplete') {
      const q = new URL(request.url, 'http://stub').searchParams.get('q') ?? '';
      const items = authors
        .filter(
          (author) =>
            author.displayName.toLowerCase().includes(q.toLowerCase()) ||
            author.handle.startsWith(q.toLowerCase()),
        )
        .map((author) => ({
          kind: 'person',
          key: author.handle,
          title: author.displayName,
          subtitle: author.headline,
        }));
      return { status: 200, body: { items } };
    }
    if (method === 'POST' && path === '/v1/link-previews') {
      const { url } = await readJson(request);
      return {
        status: 201,
        body: {
          id: ID(9400),
          url,
          status: 'ready',
          title: 'Irrigation solaire à Thiès',
          description: 'Une coopérative de 40 maraîchères.',
          siteName: 'Sahel Agri',
          imageUrl: `${origin}/files/link-3.png`,
        },
      };
    }
    const activity = /^\/v1\/(?:members\/([\w-]+)|organizations\/by-slug\/([\w-]+))\/posts$/.exec(
      path,
    );
    if (activity && method === 'GET') {
      const handle = activity[1];
      const items = postsOf(email).filter(
        (item) => item.author.type === 'member' && item.author.member.handle === handle,
      );
      return { status: 200, body: { items: items.slice(0, 3), nextCursor: null } };
    }
    const one = /^\/v1\/posts\/([\w-]+)(\/[\w/]+)?$/.exec(path);
    if (one) {
      const [, id, rest = ''] = one;
      const target = postsOf(email).find((item) => item.id === id);
      if (!target) return problem(404, 'CONTENT_POST_NOT_FOUND');
      if (method === 'GET' && rest === '') return { status: 200, body: target };
      if (method === 'PATCH' && rest === '') {
        const body = await readJson(request);
        log('post-update', email, { id, body });
        Object.assign(
          target,
          body.text !== undefined ? { text: body.text, editedAt: new Date().toISOString() } : {},
          body.commentsDisabled !== undefined ? { commentsDisabled: body.commentsDisabled } : {},
        );
        return { status: 200, body: target };
      }
      if (method === 'DELETE' && rest === '') {
        log('post-delete', email, { id });
        return { status: 204, body: null };
      }
      if (rest === '/save' || rest === '/hide') {
        log(`${rest.slice(1)}-${method === 'PUT' ? 'on' : 'off'}`, email, { id });
        state().saved ??= new Set();
        if (rest === '/save') {
          if (method === 'PUT') state().saved.add(id);
          else state().saved.delete(id);
        }
        return { status: 204, body: null };
      }
      if (rest === '/reposts' && method === 'POST') {
        const body = await readJson(request);
        log('repost', email, { id, body });
        return {
          status: 201,
          body: post(origin, 0, viewerCard(email), {
            id: ID(8500),
            kind: 'repost',
            text: body.comment ?? null,
            visibility: body.visibility,
            repostOf: target,
            viewerIsAuthor: true,
            reactions: reactions(0),
            commentCount: 0,
            createdAt: new Date().toISOString(),
          }),
        };
      }
      if (rest === '/reactions' && method === 'GET') {
        const type = new URL(request.url, 'http://stub').searchParams.get('type');
        const items = authors
          .map((author, index) => ({
            member: author,
            type: ['like', 'bravo', 'insightful'][index],
            reactedAt: new Date().toISOString(),
          }))
          .filter((item) => !type || item.type === type);
        return { status: 200, body: { items, nextCursor: null } };
      }
      if (rest === '/comments' && method === 'GET') {
        const items = [
          comment(1, authors[1], {
            replyCount: 1,
            text: 'Bravo @kofi-mensah, quel travail !',
            mentions: [
              {
                token: '@kofi-mensah',
                type: 'member',
                key: 'kofi-mensah',
                displayName: 'Kofi Mensah',
              },
            ],
          }),
          comment(2, authors[2]),
          comment(3, viewerCard(email), { viewerIsAuthor: true, viewerCanDelete: true }),
        ];
        return { status: 200, body: { items, nextCursor: null } };
      }
      if (rest === '/comments' && method === 'POST') {
        const body = await readJson(request);
        log('comment', email, { id, body, key: request.headers['idempotency-key'] ?? null });
        return {
          status: 201,
          body: comment(50, viewerCard(email), {
            text: body.text,
            parentId: body.parentId ?? null,
            viewerIsAuthor: true,
            viewerCanDelete: true,
            createdAt: new Date().toISOString(),
          }),
        };
      }
      if (rest === '/stats' && method === 'GET') {
        const days = Array.from({ length: 7 }, (_, index) => ({
          day: new Date(Date.now() - (6 - index) * 86_400_000).toISOString().slice(0, 10),
          uniqueViewers: [4, 9, 6, 14, 11, 18, 7][index],
        }));
        return { status: 200, body: { postId: id, days } };
      }
      return problem(404, 'NOT_FOUND');
    }
    const commentRoute = /^\/v1\/comments\/([\w-]+)(\/[\w]+)?$/.exec(path);
    if (commentRoute) {
      const [, id, rest = ''] = commentRoute;
      if (rest === '/replies') {
        return {
          status: 200,
          body: {
            items: [comment(10, authors[0], { parentId: id, text: 'Merci à vous !' })],
            nextCursor: null,
          },
        };
      }
      if (rest === '/reaction') {
        log('comment-reaction', email, { id, method });
        const body = method === 'PUT' ? await readJson(request) : {};
        return { status: 200, body: reactions(1, body.type ?? null) };
      }
      if (method === 'PATCH') {
        const body = await readJson(request);
        log('comment-update', email, { id, body });
        return {
          status: 200,
          body: comment(3, viewerCard(email), {
            id,
            text: body.text,
            viewerIsAuthor: true,
            viewerCanDelete: true,
            editedAt: new Date().toISOString(),
          }),
        };
      }
      if (method === 'DELETE') {
        log('comment-delete', email, { id });
        return { status: 204, body: null };
      }
    }
    return problem(404, 'NOT_FOUND');
  };
}
