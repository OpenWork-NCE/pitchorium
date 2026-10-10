// Projects of the stub api (PROMPT FRONT 5A): the showcase, the page of a project in each status
// (funding, funded, closed, a draft for its team), the methodology of the demonstration, the
// indicative currency of a member of the CFA zone. Every value is fictitious.

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-10T09:00:00.000Z');
const iso = (offsetDays) => new Date(NOW + offsetDays * DAY).toISOString();
const eur = (euros) => ({ amountMinor: String(euros * 100), currency: 'EUR' });

const AISSATOU = {
  handle: 'aissatou-ba',
  displayName: 'Aïssatou Ba',
  headline: 'Fondatrice, Ferme solaire de Thiès',
  avatarUrl: null,
};
const MOUSSA = {
  handle: 'moussa-diop',
  displayName: 'Moussa Diop',
  headline: 'Ingénieur solaire, Thiès',
  avatarUrl: null,
};
const IFEOMA = {
  handle: 'ifeoma-okafor',
  displayName: 'Ifeoma Okafor',
  headline: 'Designer produit, Lagos',
  avatarUrl: null,
};

const ORGANIZATION = {
  id: '0192f4a0-4000-7000-8000-000000000001',
  slug: 'fondation-teranga',
  name: 'Fondation Teranga',
  logoUrl: null,
  verified: true,
};

/** The methodology of the demonstration (labels in `reference.impactDemo`). */
const METHODOLOGY = {
  id: '0192f4a0-7000-7000-8000-000000000001',
  version: 1,
  name: 'DEMO, non contractuelle',
  status: 'published',
  demo: true,
  criteria: ['criterion01', 'criterion02', 'criterion03'].map((key, index) => ({
    key,
    labelKey: `impactDemo.${key}.label`,
    descriptionKey: `impactDemo.${key}.description`,
    weight: [40, 35, 25][index],
    scale: ['none', 'partial', 'full'].map((level, value) => ({
      key: level,
      labelKey: `impactDemo.levels.${level}`,
      value,
    })),
  })),
  createdAt: iso(-200),
  publishedAt: iso(-190),
  archivedAt: null,
};

function assessment(score) {
  return {
    id: '0192f4a0-7100-7000-8000-000000000001',
    subjectType: 'project',
    selfDeclared: true,
    methodology: { id: METHODOLOGY.id, version: 1, name: METHODOLOGY.name, demo: true },
    score,
    level: score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'emerging',
    details: METHODOLOGY.criteria.map((criterion, index) => ({
      criterionKey: criterion.key,
      labelKey: criterion.labelKey,
      descriptionKey: criterion.descriptionKey,
      weight: criterion.weight,
      answerKey: index === 2 ? 'partial' : 'full',
      answerLabelKey: `impactDemo.levels.${index === 2 ? 'partial' : 'full'}`,
      value: index === 2 ? 1 : 2,
      maxValue: 2,
    })),
    source: 'answered',
    reassessmentSuggested: false,
    submittedAt: iso(-40),
  };
}

const image = (origin, n, alt) => {
  const url = `${origin}/files/project-${n}.png`;
  return {
    mediaId: `0192f4a0-9500-7000-8000-${String(n).padStart(12, '0')}`,
    url,
    variants: {
      large: { width: 640, height: 400, webp: url, avif: null },
      medium: { width: 640, height: 400, webp: url, avif: null },
    },
    alt,
  };
};

/** The projects of the stub, by slug. */
function catalogue(origin) {
  return {
    'ferme-solaire-thies': {
      id: '0192f4a0-3000-7000-8000-666572736f6c',
      title: 'Ferme solaire coopérative de Thiès',
      summary:
        'Des pompes et des séchoirs solaires en location pour les coopératives maraîchères de la région de Thiès.',
      status: 'funding',
      sectorCode: 'energy',
      countryCodes: ['SN'],
      collected: 12_500,
      goal: 20_000,
      thresholds: [5_000, 12_000, 20_000],
      uses: [
        'Deux pompes solaires installées chez les premières coopératives',
        'Un séchoir solaire partagé et la formation de dix techniciennes',
        'L’atelier de maintenance et le stock de pièces pour trois ans',
      ],
      daysLeft: 12,
      contributionCount: 86,
      instruments: ['donation', 'reward_crowdfunding', 'love_money'],
      opensCapital: true,
      featured: true,
      organization: ORGANIZATION,
      video: {
        provider: 'youtube',
        videoId: 'dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      },
      gallery: [
        image(origin, 1, 'Les panneaux solaires de la coopérative de Keur Moussa au lever du jour'),
        image(origin, 2, 'Une technicienne contrôle le débit d’une pompe solaire'),
        image(origin, 3, null),
      ],
      rewards: [
        {
          id: '0192f4a0-3600-7000-8000-000000000001',
          title: 'Carte postale de la coopérative',
          description: 'Une carte écrite par les maraîchères, envoyée depuis Thiès.',
          minAmount: eur(20),
          instruments: ['donation', 'reward_crowdfunding'],
          quantity: null,
          available: null,
          soldOut: false,
          estimatedDelivery: '2026-12-01',
        },
        {
          id: '0192f4a0-3600-7000-8000-000000000002',
          title: 'Panier de légumes séchés',
          description: 'Mangues, oignons et piments séchés au soleil par la coopérative.',
          minAmount: eur(60),
          instruments: ['reward_crowdfunding'],
          quantity: 40,
          available: 0,
          soldOut: true,
          estimatedDelivery: '2027-01-15',
        },
        {
          id: '0192f4a0-3600-7000-8000-000000000003',
          title: 'Visite de la ferme',
          description: 'Une journée sur place avec l’équipe, le transport depuis Dakar compris.',
          minAmount: eur(250),
          instruments: ['reward_crowdfunding'],
          quantity: 10,
          available: 7,
          soldOut: false,
          estimatedDelivery: '2027-03-01',
        },
      ],
      updates: [
        {
          id: '0192f4a0-3700-7000-8000-000000000001',
          projectId: '0192f4a0-3000-7000-8000-666572736f6c',
          author: AISSATOU,
          text: 'La deuxième pompe est installée à Keur Moussa. Merci aux 86 contributrices et contributeurs : le premier palier est atteint.',
          images: [image(origin, 4, 'La deuxième pompe, posée sur son socle en béton')],
          publishedAt: iso(-3),
          editedAt: null,
        },
      ],
      team: [
        { member: AISSATOU, role: 'owner', function: 'Fondatrice et directrice' },
        { member: MOUSSA, role: 'editor', function: 'Responsable technique' },
      ],
      impactScore: 88,
      documents: [
        {
          mediaId: '0192f4a0-9600-7000-8000-000000000001',
          pageCount: 12,
          thumbnailUrl: `${origin}/files/document-portrait-1.png`,
        },
      ],
    },
    'cooperative-karite-kaolack': {
      id: '0192f4a0-3000-7000-8000-6b6172697465',
      title: 'Coopérative de karité de Kaolack',
      summary:
        'Une presse et un atelier de conditionnement pour 120 productrices de beurre de karité.',
      status: 'funded',
      sectorCode: 'agriculture_forestry_fishing',
      countryCodes: ['SN', 'ML'],
      collected: 31_200,
      goal: 30_000,
      thresholds: [10_000, 30_000],
      uses: ['La presse et son installation', 'L’atelier de conditionnement et la certification'],
      daysLeft: 6,
      contributionCount: 214,
      instruments: ['donation', 'grant'],
      opensCapital: false,
      featured: false,
      organization: null,
      video: null,
      gallery: [image(origin, 5, 'Des productrices trient les noix de karité')],
      rewards: [],
      updates: [],
      team: [{ member: AISSATOU, role: 'owner', function: null }],
      impactScore: 64,
      documents: [],
    },
    'sechoirs-mbour': {
      id: '0192f4a0-3000-7000-8000-73656368706f',
      title: 'Séchoirs à poisson de Mbour',
      summary:
        'Des claies de séchage couvertes pour les transformatrices du quai de pêche de Mbour.',
      status: 'closed',
      sectorCode: 'agriculture_forestry_fishing',
      countryCodes: ['SN'],
      collected: 8_400,
      goal: 15_000,
      thresholds: [6_000, 15_000],
      uses: ['Vingt claies couvertes', 'Le hangar de stockage'],
      daysLeft: 0,
      contributionCount: 61,
      instruments: ['donation'],
      opensCapital: false,
      featured: false,
      organization: null,
      video: null,
      gallery: [],
      rewards: [],
      updates: [],
      team: [{ member: IFEOMA, role: 'owner', function: null }],
      impactScore: null,
      documents: [],
    },
    'projet-en-preparation': {
      id: '0192f4a0-3000-7000-8000-70726f6a6574',
      title: 'Séchoirs solaires de Podor',
      summary: 'Des séchoirs solaires pour la mangue des coopératives de femmes de Podor.',
      status: 'draft',
      sectorCode: 'agriculture_forestry_fishing',
      countryCodes: ['SN'],
      collected: 0,
      goal: 15_000,
      thresholds: [4_000, 15_000],
      uses: ['Trois séchoirs et leur abri', 'L’atelier de conditionnement'],
      daysLeft: null,
      contributionCount: 0,
      instruments: ['donation', 'reward_crowdfunding'],
      opensCapital: false,
      featured: false,
      organization: null,
      video: null,
      gallery: [image(origin, 6, 'Des mangues tranchées sur une claie de séchage')],
      rewards: [
        {
          id: '0192f4a0-3600-7000-8000-000000000010',
          title: 'Sachet de mangue séchée',
          description: 'Un sachet de 250 g de la première récolte séchée.',
          minAmount: eur(25),
          instruments: ['reward_crowdfunding'],
          quantity: 100,
          available: 100,
          soldOut: false,
          estimatedDelivery: '2027-06-01',
        },
      ],
      updates: [],
      team: [
        { member: AISSATOU, role: 'owner', function: 'Porteuse du projet' },
        { member: MOUSSA, role: 'editor', function: 'Responsable technique' },
      ],
      impactScore: null,
      documents: [],
    },
  };
}

function cardOf(slug, item) {
  return {
    id: item.id,
    slug,
    title: item.title,
    summary: item.summary,
    status: item.status,
    sectorCode: item.sectorCode,
    countryCodes: item.countryCodes,
    coverImageUrl: item.gallery[0]?.url ?? null,
    owner: item.team[0].member,
    organization: item.organization,
    funding: {
      goal: item.goal === null ? null : eur(item.goal),
      collected: eur(item.collected),
      progressPercent: item.goal ? Math.floor((item.collected / item.goal) * 100) : 0,
      contributionCount: item.contributionCount,
      daysLeft: item.status === 'draft' ? null : item.daysLeft,
      instruments: item.instruments,
      opensCapital: item.opensCapital,
    },
    impact:
      item.impactScore === null
        ? null
        : {
            selfDeclared: true,
            score: item.impactScore,
            level:
              item.impactScore >= 70 ? 'strong' : item.impactScore >= 40 ? 'moderate' : 'emerging',
            methodologyVersion: 1,
          },
    featured: item.featured,
    publishedAt: item.status === 'draft' ? null : iso(-60),
    endsAt: item.status === 'draft' ? null : iso(item.daysLeft),
  };
}

/** The page of a project as the api gives it: `team` for the team (management data). */
function projectOf(slug, item, { member, team }) {
  return {
    ...cardOf(slug, item),
    description:
      item.status === 'draft'
        ? '## Pourquoi\n\nÀ Podor, la moitié des mangues se perd faute de séchage.'
        : `## Pourquoi\n\nÀ Thiès, les maraîchères perdent un tiers de leurs récoltes faute d’eau et de séchage. **La location de pompes solaires** coûte moins que le gasoil, et la coopérative en garde la maintenance.\n\n## Comment\n\n- des pompes louées à la saison ;\n- un séchoir partagé ;\n- dix techniciennes formées.\n\nEn savoir plus sur [le programme de la coopérative](https://example.org/programme).`,
    impactArea:
      item.status === 'draft'
        ? 'Podor, vallée du fleuve Sénégal'
        : 'Région de Thiès, 12 coopératives',
    video: item.video,
    gallery: item.gallery,
    documents: member ? item.documents : [],
    tiers: (item.thresholds ?? []).map((euros, index) => ({
      id: `${item.id.slice(0, 24)}${String(index + 1).padStart(12, '0')}`,
      position: index + 1,
      threshold: eur(euros),
      description: item.uses[index],
      unlocked: item.collected >= euros,
      unlockedAt: item.collected >= euros ? iso(-30 + index * 5) : null,
    })),
    rewards: item.rewards,
    updates: item.updates,
    team: item.team,
    impactAssessment: item.impactScore === null ? null : assessment(item.impactScore),
    share: { title: item.title, description: item.summary, imageUrl: item.gallery[0]?.url ?? null },
    fundingFrozen: false,
    viewer: member ? { following: false, teamRole: team ? 'owner' : null } : null,
    management: team
      ? {
          viewerRole: 'owner',
          moderationStatus: 'visible',
          durationDays: 60,
          fundingLocked: item.contributionCount > 0,
          publicDisplayConsentAt: item.status === 'draft' ? null : iso(-60),
          invitations: [],
          impactAssessmentRequired: true,
          createdAt: iso(-90),
          updatedAt: iso(-3),
        }
      : null,
  };
}

export function projectRoutes({ origin, accounts, sessionOf, problem, state }) {
  const projects = catalogue(origin);
  const visible = (slug) => projects[slug] && projects[slug].status !== 'draft';
  const isTeam = (email, item) =>
    Boolean(email) && item.team.some((member) => member.member.handle === accounts[email]?.handle);
  const log = (route, email, extra = {}) =>
    state().writes.push({ route, email, ...extra, at: new Date().toISOString() });

  return function projectsRoute(request, path, url) {
    const method = request.method;
    if (method === 'GET' && (path === '/v1/projects' || path === '/v1/public/projects')) {
      if (path === '/v1/projects' && !sessionOf(request)) return problem(401, 'UNAUTHENTICATED');
      const query = url.searchParams;
      let items = Object.entries(projects).filter(([slug]) => visible(slug));
      if (query.get('featured') === 'true') items = items.filter(([, item]) => item.featured);
      if (query.get('status'))
        items = items.filter(([, item]) => item.status === query.get('status'));
      if (query.get('countryCode')) {
        items = items.filter(([, item]) => item.countryCodes.includes(query.get('countryCode')));
      }
      if (query.get('sectorCode')) {
        items = items.filter(([, item]) => item.sectorCode === query.get('sectorCode'));
      }
      if (query.get('minImpact')) {
        items = items.filter(
          ([, item]) => (item.impactScore ?? -1) >= Number(query.get('minImpact')),
        );
      }
      if (query.get('memberHandle')) {
        items = items.filter(([, item]) =>
          item.team.some((member) => member.member.handle === query.get('memberHandle')),
        );
      }
      if (query.get('sort') === 'ending_soon') {
        items = items
          .filter(([, item]) => item.status !== 'closed')
          .sort(([, a], [, b]) => a.daysLeft - b.daysLeft);
      }
      return {
        status: 200,
        body: { items: items.map(([slug, item]) => cardOf(slug, item)), nextCursor: null },
      };
    }
    const publicProject = /^\/v1\/public\/projects\/([\w-]+)$/.exec(path);
    if (method === 'GET' && publicProject) {
      const slug = publicProject[1];
      return visible(slug)
        ? { status: 200, body: projectOf(slug, projects[slug], { member: false, team: false }) }
        : problem(404, 'PROJECTS_NOT_FOUND');
    }
    const memberProject = /^\/v1\/projects\/by-slug\/([\w-]+)$/.exec(path);
    if (method === 'GET' && memberProject) {
      const email = sessionOf(request);
      if (!email) return problem(401, 'UNAUTHENTICATED');
      const slug = memberProject[1];
      const item = projects[slug];
      if (!item) return problem(404, 'PROJECTS_NOT_FOUND');
      // A draft for its team only; here any member reads it, as its team (stub).
      const team = isTeam(email, item) || item.status === 'draft';
      return { status: 200, body: projectOf(slug, item, { member: true, team }) };
    }
    const byId = /^\/v1\/projects\/(0192f4a0-3000-[\w-]+)$/.exec(path);
    if (method === 'GET' && byId) {
      const entry = Object.entries(projects).find(([, item]) => item.id === byId[1]);
      return entry && visible(entry[0])
        ? { status: 200, body: projectOf(entry[0], entry[1], { member: true, team: false }) }
        : problem(404, 'PROJECTS_NOT_FOUND');
    }
    if (method === 'GET' && /^\/v1\/(public\/)?projects\/[\w-]+\/posts$/.test(path)) {
      return { status: 200, body: { items: [], nextCursor: null } };
    }
    if (method === 'GET' && path === '/v1/impact/methodology') {
      return state().methodologyWithdrawn
        ? problem(409, 'IMPACT_METHODOLOGY_UNAVAILABLE')
        : { status: 200, body: METHODOLOGY };
    }
    // A test withdraws the methodology (no published version, ADR 0036).
    if (method === 'POST' && path === '/__test/methodology') {
      state().methodologyWithdrawn = true;
      return { status: 200, body: { withdrawn: true } };
    }
    if (method === 'GET' && path === '/v1/me/indicative-currency') {
      const email = sessionOf(request);
      if (!email) return problem(401, 'UNAUTHENTICATED');
      // The demonstration accounts declare Senegal: the West African CFA franc.
      return {
        status: 200,
        body: { country: 'SN', fixedParity: { currency: 'XOF', unitsPerEur: '655.957' } },
      };
    }
    const preview = /^\/v1\/projects\/(0192f4a0-3000-[\w-]+)\/preview$/.exec(path);
    if (method === 'GET' && preview) {
      const entry = Object.entries(projects).find(([, item]) => item.id === preview[1]);
      return entry
        ? { status: 200, body: projectOf(entry[0], entry[1], { member: false, team: false }) }
        : problem(404, 'PROJECTS_NOT_FOUND');
    }
    const updates = /^\/v1\/projects\/(0192f4a0-3000-[\w-]+)\/updates$/.exec(path);
    if (method === 'GET' && updates) {
      const entry = Object.entries(projects).find(([, item]) => item.id === updates[1]);
      return { status: 200, body: { items: entry?.[1].updates ?? [], nextCursor: null } };
    }
    if (method === 'GET' && /^\/v1\/projects\/[\w-]+\/impact-assessments\/prefill$/.test(path)) {
      return {
        status: 200,
        body: {
          methodologyId: METHODOLOGY.id,
          answers: { criterion01: 'full', criterion02: 'partial' },
        },
      };
    }
    const interest = /^\/v1\/projects\/([\w-]+)\/interests$/.exec(path);
    if (method === 'GET' && interest) {
      return {
        status: 200,
        body: {
          items: [
            {
              id: '0192f4a0-3800-7000-8000-000000000002',
              kind: 'grant',
              member: IFEOMA,
              message:
                'Notre fondation finance l’équipement des coopératives. Pouvons-nous en parler ?',
              indicativeAmount: eur(10_000),
              documents: [{ mediaId: '0192f4a0-9700-7000-8000-000000000001' }],
              createdAt: iso(-2),
            },
            {
              id: '0192f4a0-3800-7000-8000-000000000003',
              kind: 'general',
              member: MOUSSA,
              message: 'Je peux aider pour la maintenance des pompes.',
              indicativeAmount: null,
              documents: [],
              createdAt: iso(-5),
            },
          ],
          nextCursor: null,
        },
      };
    }
    if (method === 'POST' && interest) {
      const email = sessionOf(request);
      if (!email) return problem(401, 'UNAUTHENTICATED');
      log('interest', email, { projectId: interest[1] });
      return { status: 201, body: { id: '0192f4a0-3800-7000-8000-000000000001' } };
    }
    return null;
  };
}
