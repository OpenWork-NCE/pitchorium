// Stub of the reports, the moderation, the personal data and the translation (PROMPT FRONT 8B):
// the states the screens draw, by account (stub-api.mjs). Fictitious data, like the rest of the
// stub. The real rules live in the api: here only the answers the web reads.

const ID = (n) => `0192f4a0-8000-7000-8000-${String(n).padStart(12, '0')}`;
const DAY = 86_400_000;
const at = (days) => new Date(Date.now() + days * DAY).toISOString();

const REASONS = [
  'spam',
  'harassment',
  'fraud',
  'illegal_content',
  'misleading_information',
  'intellectual_property',
  'other',
];

/** Decisions of the moderation by handle: a suspended member, a member with an appeal pending. */
function standingOf(handle) {
  if (handle === 'moussa-diop') {
    return {
      suspension: {
        id: ID(301),
        userId: ID(1),
        decisionId: ID(201),
        startsAt: at(-2),
        endsAt: at(12),
        liftedAt: null,
      },
      decisions: [
        {
          id: ID(201),
          caseId: ID(101),
          targetType: 'profile',
          targetId: ID(1),
          kind: 'suspend',
          reason: 'fraud',
          statement:
            'Plusieurs membres rapportent des demandes de paiement par transfert direct, hors de la plateforme et de ses protections.',
          ground: 'terms',
          groundReference: 'Conditions d’utilisation, paiements',
          automatedDetection: false,
          suspensionEndsAt: at(12),
          decidedAt: at(-2),
          appealableUntil: at(181),
          appeal: null,
        },
        {
          id: ID(202),
          caseId: ID(102),
          targetType: 'post',
          targetId: ID(2),
          kind: 'warn',
          reason: 'spam',
          statement:
            'La même offre commerciale a été publiée plusieurs jours de suite à des membres hors de votre réseau.',
          ground: 'terms',
          groundReference: null,
          automatedDetection: true,
          suspensionEndsAt: null,
          decidedAt: at(-40),
          appealableUntil: at(143),
          appeal: {
            id: ID(401),
            decisionId: ID(202),
            statement: 'Ces membres avaient demandé nos tarifs lors d’un salon.',
            status: 'upheld',
            outcomeStatement:
              'Les messages ont été envoyés à des membres qui ne vous avaient pas contacté sur Pitchorium ; l’avertissement est maintenu.',
            createdAt: at(-38),
            resolvedAt: at(-35),
          },
        },
      ],
    };
  }
  return { suspension: null, decisions: [] };
}

/** The personal data of each account: an export ready, a blocker, an erasure in its grace period. */
function privacyOf(handle, state) {
  const own = (state[handle] ??= {});
  if (own.erasure === undefined) {
    own.erasure =
      handle === 'koffi-agbodjan'
        ? {
            id: ID(601),
            status: 'scheduled',
            requestedAt: at(-3),
            scheduledFor: at(27),
            canceledAt: null,
            completedAt: null,
            blockedBy: null,
            reminderAt: at(20),
          }
        : null;
  }
  own.exports ??=
    handle === 'aissatou-ba'
      ? [
          {
            id: ID(501),
            status: 'ready',
            requestedAt: at(-0.2),
            completedAt: at(-0.19),
            expiresAt: at(2.8),
            sizeBytes: 18_400_000,
          },
          {
            id: ID(502),
            status: 'expired',
            requestedAt: at(-30),
            completedAt: at(-30),
            expiresAt: at(-27),
            sizeBytes: 17_900_000,
          },
        ]
      : [];
  const latest = own.exports[0];
  return {
    exports: own.exports,
    nextExportAt:
      latest && latest.status !== 'failed' && Date.parse(latest.requestedAt) > Date.now() - DAY
        ? new Date(Date.parse(latest.requestedAt) + DAY).toISOString()
        : null,
    erasure: own.erasure,
    erasureBlockers:
      handle === 'aissatou-ba'
        ? [
            {
              code: 'PRIVACY_CAMPAIGN_IN_PROGRESS',
              resource: {
                type: 'project',
                slug: 'ferme-solaire-thies',
                name: 'Ferme solaire de Thiès',
              },
            },
          ]
        : [],
  };
}

/** A French version of the English contents of the stub (post 2, the bio of Nadia Benali). */
const TRANSLATIONS = {
  text: 'Court et clair : nous recrutons une mentore finance.',
  bio: 'Investisseuse à impact entre Paris et Dakar.',
  description: 'Une description traduite.',
};

export function trustRoutes({ origin, accounts, sessionOf, problem, readJson, state }) {
  const own = () => (state().trust ??= { reports: [], privacy: {}, appeals: {} });
  const log = (route, email, extra = {}) =>
    state().writes.push({ route, email, ...extra, at: new Date().toISOString() });
  const handleOf = (request) => {
    const email = sessionOf(request);
    return email ? accounts[email].handle : null;
  };

  return async (request, path) => {
    const method = request.method;
    // The archive behind the short link of an export (a file of the private bucket in the api).
    if (method === 'GET' && path === '/files/export.zip') {
      return {
        status: 200,
        raw: Buffer.from('PK\u0005\u0006'.padEnd(22, '\u0000'), 'latin1'),
        headers: {
          'content-type': 'application/zip',
          'content-disposition': 'attachment; filename="pitchorium-export.zip"',
        },
      };
    }
    if (method === 'GET' && path === '/v1/reports/reasons') {
      return {
        status: 200,
        body: { items: REASONS.map((code) => ({ code, labelKey: `reportReasons.${code}` })) },
      };
    }
    if (method === 'POST' && path === '/v1/public/reports') {
      const body = await readJson(request);
      log('notice', null, { target: `${body.targetType}:${body.targetId}` });
      return { status: 201, body: { id: ID(901), receivedAt: new Date().toISOString() } };
    }
    if (
      !path.startsWith('/v1/reports') &&
      !path.startsWith('/v1/me/') &&
      path !== '/v1/translations'
    ) {
      return undefined;
    }
    const email = sessionOf(request);
    const handle = handleOf(request);
    if (method === 'POST' && path === '/v1/reports') {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      const body = await readJson(request);
      const key = `${email}:${body.targetType}:${body.targetId}`;
      if (own().reports.some((report) => report.key === key)) {
        return problem(409, 'TRUST_REPORT_DUPLICATE');
      }
      const report = {
        key,
        id: ID(700 + own().reports.length),
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        status: 'received',
        outcome: null,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      own().reports.push(report);
      log('report', email, { target: `${body.targetType}:${body.targetId}`, reason: body.reason });
      const { key: _key, ...view } = report;
      return { status: 201, body: view };
    }
    if (method === 'GET' && path === '/v1/me/reports') {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      const items = own()
        .reports.filter((report) => report.key.startsWith(`${email}:`))
        .map(({ key: _key, ...view }) => view);
      return { status: 200, body: { items, nextCursor: null } };
    }
    if (method === 'GET' && path === '/v1/me/moderation') {
      if (!handle) return problem(401, 'UNAUTHENTICATED');
      const standing = standingOf(handle);
      const appealed = own().appeals;
      return {
        status: 200,
        body: {
          ...standing,
          decisions: standing.decisions.map((decision) => ({
            ...decision,
            appeal: decision.appeal ?? appealed[decision.id] ?? null,
          })),
        },
      };
    }
    const appeal = /^\/v1\/me\/moderation\/decisions\/([\w-]+)\/appeal$/.exec(path);
    if (method === 'POST' && appeal) {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      const body = await readJson(request);
      const created = {
        id: ID(402),
        decisionId: appeal[1],
        statement: body.statement,
        status: 'pending',
        outcomeStatement: null,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      own().appeals[appeal[1]] = created;
      log('appeal', email, { decision: appeal[1] });
      return { status: 201, body: created };
    }
    if (path.startsWith('/v1/me/privacy')) {
      if (!handle) return problem(401, 'UNAUTHENTICATED');
      const privacy = own().privacy;
      if (method === 'GET' && path === '/v1/me/privacy') {
        return { status: 200, body: privacyOf(handle, privacy) };
      }
      if (method === 'POST' && path === '/v1/me/privacy/exports') {
        const overview = privacyOf(handle, privacy);
        if (overview.nextExportAt) return problem(429, 'PRIVACY_EXPORT_RATE_LIMITED');
        const created = {
          id: ID(503),
          status: 'pending',
          requestedAt: new Date().toISOString(),
          completedAt: null,
          expiresAt: null,
          sizeBytes: null,
        };
        privacy[handle].exports.unshift(created);
        log('export', email);
        return { status: 201, body: created };
      }
      const download = /^\/v1\/me\/privacy\/exports\/([\w-]+)\/download-url$/.exec(path);
      if (method === 'POST' && download) {
        log('export-download', email, { export: download[1] });
        return {
          status: 200,
          body: {
            url: `${origin}/files/export.zip`,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
        };
      }
      if (method === 'POST' && path === '/v1/me/privacy/erasure') {
        const overview = privacyOf(handle, privacy);
        const [blocker] = overview.erasureBlockers;
        if (blocker) return problem(409, blocker.code);
        // A session older than a few minutes is not enough (the api asks for a recent one).
        if (request.headers.cookie?.includes('stub-stale=1')) {
          return problem(403, 'ACCESS_REAUTHENTICATION_REQUIRED');
        }
        privacy[handle].erasure = {
          id: ID(602),
          status: 'scheduled',
          requestedAt: new Date().toISOString(),
          scheduledFor: at(30),
          canceledAt: null,
          completedAt: null,
          blockedBy: null,
          reminderAt: at(23),
        };
        log('erasure', email);
        return { status: 201, body: privacy[handle].erasure };
      }
      if (method === 'POST' && path === '/v1/me/privacy/erasure/cancel') {
        privacy[handle].erasure = null;
        log('erasure-cancel', email);
        return { status: 204 };
      }
    }
    if (method === 'POST' && path === '/v1/translations') {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      const body = await readJson(request);
      if (request.headers.cookie?.includes('stub-translation-cap=1')) {
        return problem(429, 'LOCALIZATION_MEMBER_LIMIT_REACHED');
      }
      log('translate', email, { source: `${body.sourceType}:${body.sourceId}` });
      return {
        status: 200,
        body: {
          sourceType: body.sourceType,
          sourceId: body.sourceId,
          targetLocale: body.targetLocale,
          sourceLanguage: 'en',
          fields: TRANSLATIONS,
          machineTranslated: true,
          provider: 'deepl',
          notice: 'common.machineTranslation',
          cached: false,
        },
      };
    }
    return undefined;
  };
}
