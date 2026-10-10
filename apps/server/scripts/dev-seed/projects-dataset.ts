import type { ImpactMethodologyDraft, ProjectInterestKind } from '@pitchorium/contracts';

/**
 * Demonstration projects of `pnpm db:seed:dev`: fictitious campaigns of the demo members, in
 * every status. Names, figures and texts are invented. Amounts are in whole euros.
 */

/** Fictitious methodology, named and labelled as such: never contractual (ADR 0036). */
export const DEMO_METHODOLOGY: ImpactMethodologyDraft = {
  name: 'DEMO, non contractuelle',
  criteria: [1, 2, 3, 4].map((index) => ({
    key: `demo_criterion_${index}`,
    labelKey: `impactDemo.criterion0${index}.label`,
    descriptionKey: `impactDemo.criterion0${index}.description`,
    weight: index,
    scale: [
      { key: 'none', labelKey: 'impactDemo.levels.none', value: 0 },
      { key: 'partial', labelKey: 'impactDemo.levels.partial', value: 1 },
      { key: 'full', labelKey: 'impactDemo.levels.full', value: 2 },
    ],
  })),
};

type Level = 'none' | 'partial' | 'full';

/** Answers of the DEMO methodology, in the order of its criteria. */
export const demoAnswers = (...levels: [Level, Level, Level, Level]): Record<string, string> =>
  Object.fromEntries(levels.map((level, index) => [`demo_criterion_${index + 1}`, level]));

/** Self-declared assessments of the entrepreneur facets of the project owners. */
export const DEMO_FACET_ASSESSMENTS: Readonly<Record<string, Record<string, string>>> = {
  aissatou: demoAnswers('full', 'full', 'partial', 'full'),
  ama: demoAnswers('partial', 'full', 'partial', 'partial'),
  jeanbaptiste: demoAnswers('full', 'partial', 'full', 'full'),
  marieclaire: demoAnswers('full', 'full', 'full', 'partial'),
  samuel: demoAnswers('partial', 'none', 'partial', 'partial'),
  grace: demoAnswers('full', 'full', 'full', 'full'),
  moussa: demoAnswers('none', 'partial', 'partial', 'none'),
};

export interface DemoReward {
  title: string;
  description: string;
  minAmount: number;
  instruments: ('donation' | 'reward_crowdfunding')[];
  quantity?: number;
  estimatedDelivery?: string;
}

export interface DemoProject {
  key: string;
  owner: string;
  /** Organization of the demo data that carries the project, its owner being owner or admin. */
  organizationKey?: string;
  title: string;
  summary?: string;
  description?: string;
  sectorCode?: string;
  impactArea?: string;
  countryCodes?: string[];
  videoUrl?: string;
  instruments?: (
    'donation' | 'reward_crowdfunding' | 'love_money' | 'grant' | 'honor_loan' | 'equity'
  )[];
  opensCapital?: boolean;
  /** Each tier: cumulative threshold and use of the funds; the last one is the goal. */
  tiers?: { threshold: number; description: string }[];
  durationDays?: number;
  rewards?: DemoReward[];
  /** Days before the seeding; absent for a draft. */
  publishedDaysAgo?: number;
  /** Paid contributions applied through the facade, with the reward taken by each. */
  /**
   * Contributions paid through the payments module and its simulated provider (ADR 0035), by a
   * member (or on behalf of an organization they administer), in euros or in CFA francs at the
   * fixed parity, with the reward taken by each.
   */
  contributions?: {
    contributor: string;
    organization?: string;
    amount: number;
    /** Paid in XOF: `amount` euros at the fixed parity, exactly. */
    inXof?: boolean;
    daysAfterPublication: number;
    rewardIndex?: number;
  }[];
  /** Images of the gallery (abstract demonstration images), each with its text alternative. */
  gallery?: { hue: number; alt: string }[];
  /** Private documents of the project: abstract PDFs, by number of pages. */
  documents?: number[];
  updates?: { author: string; daysAfterPublication: number; text: string }[];
  editor?: { member: string; function: string };
  interests?: { member: string; kind: ProjectInterestKind; message: string; amount?: number }[];
  followers?: string[];
  /** Publications of the team attached to the project. */
  posts?: { author: string; text: string }[];
}

/**
 * Country of the payout account each collecting holder chose: never the country of their profile
 * nor of their project (ADR 0043). Aïssatou lives in Senegal and Jean-Baptiste in Côte d'Ivoire,
 * where no rail is verified: their accounts are in France.
 */
export const DEMO_PAYOUT_COUNTRIES: Readonly<Record<string, string>> = {
  aissatou: 'FR',
  ama: 'GH',
  jeanbaptiste: 'FR',
  marieclaire: 'FR',
  samuel: 'NG',
};

export const DEMO_PROJECTS: readonly DemoProject[] = [
  {
    key: 'pompes-thies',
    owner: 'aissatou',
    organizationKey: 'femmes-sahel',
    title: 'Pompes solaires pour les maraîchères de Thiès',
    summary:
      'Équiper 40 coopératives de maraîchères de kits de pompage solaire en location-vente, payables au rythme des récoltes.',
    description:
      "## Le projet\n\nLes maraîchères de la région de Thiès arrosent encore **à la main** ou avec des motopompes au gasoil. Nos kits solaires réduisent la corvée d'eau et le coût de l'irrigation.\n\n## Ce que financent les paliers\n\n- l'étude des sites et des besoins en eau ;\n- l'achat groupé de 40 kits ;\n- l'installation et la formation à la maintenance.\n\n> Les coopératives remboursent le kit sur trois saisons.\n\nEn savoir plus sur [notre démarche](https://example.org/sahel-agri).",
    sectorCode: 'agriculture_forestry_fishing',
    impactArea: 'Région de Thiès, Sénégal',
    countryCodes: ['SN'],
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    instruments: ['donation', 'reward_crowdfunding', 'love_money'],
    tiers: [
      { threshold: 6_000, description: 'Étude des sites et des besoins en eau' },
      { threshold: 20_000, description: 'Achat groupé de 40 kits solaires' },
      { threshold: 30_000, description: 'Installation et formation à la maintenance' },
    ],
    durationDays: 45,
    rewards: [
      {
        title: 'Panier de légumes de saison',
        description: 'Un panier livré à Dakar par une coopérative équipée.',
        minAmount: 40,
        instruments: ['reward_crowdfunding'],
        quantity: 50,
        estimatedDelivery: '2027-03-01',
      },
      {
        title: 'Visite d’une parcelle équipée',
        description: 'Une journée avec une coopérative, transport depuis Thiès compris.',
        minAmount: 250,
        instruments: ['donation', 'reward_crowdfunding'],
        // A single place, taken by a contribution below: the reward shows as sold out.
        quantity: 1,
      },
    ],
    gallery: [
      { hue: 32, alt: 'Image abstraite de démonstration, tons ocre.' },
      { hue: 140, alt: 'Image abstraite de démonstration, tons verts.' },
      { hue: 210, alt: 'Image abstraite de démonstration, tons bleus.' },
    ],
    documents: [3, 1],
    publishedDaysAgo: 20,
    contributions: [
      { contributor: 'kofi', amount: 5_000, daysAfterPublication: 1 },
      { contributor: 'fatou', amount: 2_400, daysAfterPublication: 4, rewardIndex: 0 },
      { contributor: 'thierry', amount: 5_000, daysAfterPublication: 9, rewardIndex: 1 },
    ],
    updates: [
      {
        author: 'aissatou',
        daysAfterPublication: 5,
        text: 'Premier palier atteint : l’étude des sites démarre la semaine prochaine avec trois coopératives pilotes.',
      },
      {
        author: 'moussa',
        daysAfterPublication: 12,
        text: 'Le programme de formation à la maintenance est prêt, en wolof et en français.',
      },
    ],
    editor: { member: 'moussa', function: 'Responsable de la formation' },
    interests: [
      {
        member: 'nadia',
        kind: 'grant',
        message: 'La fondation peut cofinancer la formation à la maintenance.',
        amount: 8_000,
      },
      {
        member: 'kofi',
        kind: 'honor_loan',
        message: 'Un prêt d’honneur pour l’achat groupé des kits, à discuter.',
        amount: 3_000,
      },
    ],
    followers: ['kofi', 'fatou', 'thierry'],
    posts: [
      {
        author: 'aissatou',
        text: 'Notre campagne pour les pompes solaires de Thiès est en ligne : merci à toutes les coopératives qui nous ont accompagnées.',
      },
    ],
  },
  {
    key: 'paiement-accra',
    owner: 'ama',
    title: 'Paiement mobile pour les marchés d’Accra',
    summary:
      'Une application de caisse et de paiement mobile pour les commerçantes des marchés de Makola et de Kaneshie.',
    description:
      '## Pourquoi\n\nLes commerçantes encaissent surtout en espèces et ne tiennent pas de comptes. Notre caisse mobile enregistre les ventes et accepte le Mobile Money.\n\n## Usage des fonds\n\n1. pilote sur un marché ;\n2. intégration des opérateurs ;\n3. déploiement sur deux marchés.',
    sectorCode: 'information_communication',
    impactArea: 'Grand Accra, Ghana',
    countryCodes: ['GH'],
    instruments: ['donation', 'reward_crowdfunding', 'equity'],
    opensCapital: true,
    tiers: [
      { threshold: 10_000, description: 'Pilote sur le marché de Makola' },
      { threshold: 30_000, description: 'Intégration des opérateurs de Mobile Money' },
      { threshold: 50_000, description: 'Déploiement sur deux marchés' },
    ],
    durationDays: 60,
    rewards: [
      {
        title: 'Abonnement offert à une commerçante',
        description: 'Une année d’abonnement offerte à une commerçante de Makola.',
        minAmount: 100,
        instruments: ['reward_crowdfunding'],
      },
    ],
    publishedDaysAgo: 30,
    contributions: [
      {
        contributor: 'koffi',
        organization: 'femmes-sahel',
        amount: 20_000,
        daysAfterPublication: 2,
      },
      { contributor: 'nadia', amount: 22_000, daysAfterPublication: 10 },
      { contributor: 'claudine', amount: 10_000, daysAfterPublication: 21, rewardIndex: 0 },
    ],
    updates: [
      {
        author: 'ama',
        daysAfterPublication: 22,
        text: 'Objectif atteint ! La campagne reste ouverte jusqu’à sa date de fin pour financer un troisième marché.',
      },
    ],
    interests: [
      {
        member: 'kofi',
        kind: 'equity',
        message: 'Je suis intéressé par votre prochaine levée, pouvons-nous en parler ?',
        amount: 25_000,
      },
    ],
    followers: ['kofi', 'claudine'],
    posts: [
      {
        author: 'ama',
        text: 'Cinquante commerçantes testent déjà notre caisse mobile à Makola.',
      },
    ],
  },
  {
    key: 'sechoir-soubre',
    owner: 'jeanbaptiste',
    // Carried by the Fondation Teranga, verified by seed-dev-network.ts.
    organizationKey: 'teranga',
    title: 'Séchoir solaire pour le cacao de Soubré',
    summary: 'Un séchoir solaire partagé pour améliorer la qualité du cacao de cinq villages.',
    description:
      '## Le séchoir\n\nUn séchoir sous serre réduit les pertes et la moisissure pendant la saison des pluies.',
    sectorCode: 'agriculture_forestry_fishing',
    impactArea: 'Département de Soubré, Côte d’Ivoire',
    countryCodes: ['CI'],
    instruments: ['donation', 'love_money'],
    tiers: [
      { threshold: 5_000, description: 'Fondations et structure' },
      { threshold: 15_000, description: 'Serre, claies et formation' },
    ],
    durationDays: 45,
    publishedDaysAgo: 70,
    contributions: [
      { contributor: 'fatou', amount: 9_000, inXof: true, daysAfterPublication: 3 },
      { contributor: 'koffi', amount: 9_000, daysAfterPublication: 30 },
    ],
    updates: [
      {
        author: 'jeanbaptiste',
        daysAfterPublication: 40,
        text: 'Le séchoir est construit : merci aux familles et aux amis de la diaspora.',
      },
    ],
    followers: ['thierry'],
  },
  {
    key: 'reseau-jacmel',
    owner: 'marieclaire',
    title: 'Micro-réseau solaire à Jacmel',
    summary: 'Un micro-réseau solaire pour 120 foyers et une école du quartier de Bas-Jacmel.',
    description:
      '## Contexte\n\nLe quartier subit des coupures quotidiennes. Le micro-réseau alimente les foyers et l’école.',
    sectorCode: 'energy',
    impactArea: 'Jacmel, Haïti',
    countryCodes: ['HT'],
    instruments: ['donation', 'reward_crowdfunding', 'grant'],
    tiers: [
      { threshold: 8_000, description: 'Panneaux pour l’école' },
      { threshold: 18_000, description: 'Batteries et onduleurs' },
      { threshold: 25_000, description: 'Raccordement des foyers' },
    ],
    durationDays: 60,
    rewards: [
      {
        title: 'Carte postale de l’école',
        description: 'Une carte dessinée par les élèves.',
        minAmount: 20,
        instruments: ['reward_crowdfunding'],
        quantity: 200,
      },
    ],
    publishedDaysAgo: 100,
    contributions: [
      { contributor: 'thierry', amount: 6_000, daysAfterPublication: 5 },
      { contributor: 'claudine', amount: 2_200, daysAfterPublication: 50, rewardIndex: 0 },
    ],
    interests: [
      {
        member: 'claudine',
        kind: 'general',
        message:
          'Notre réseau peut vous mettre en relation avec un installateur de Port-au-Prince.',
      },
    ],
  },
  {
    key: 'assurance-kano',
    owner: 'samuel',
    title: 'Assurance récolte indexée pour Kano',
    summary: 'Une micro-assurance déclenchée par la pluviométrie pour 2 000 petits producteurs.',
    description:
      '## Fonctionnement\n\nL’indemnité est versée automatiquement quand la pluviométrie mesurée passe sous un seuil.',
    sectorCode: 'finance_insurance',
    impactArea: 'État de Kano, Nigeria',
    countryCodes: ['NG'],
    instruments: ['donation', 'honor_loan'],
    tiers: [
      { threshold: 8_000, description: 'Stations météo et données' },
      { threshold: 20_000, description: 'Fonds de garantie de la première saison' },
    ],
    durationDays: 45,
    publishedDaysAgo: 43,
    contributions: [{ contributor: 'grace', amount: 9_000, daysAfterPublication: 6 }],
    followers: ['kofi'],
  },
  {
    key: 'kiosques-kisumu',
    owner: 'grace',
    title: 'Kiosques d’eau potable à Kisumu',
    summary: 'Six kiosques d’eau filtrée gérés par des femmes du quartier de Nyalenda.',
    description:
      '## Les kiosques\n\nChaque kiosque filtre l’eau du réseau et la vend au litre, à prix social.',
    sectorCode: 'water_waste',
    impactArea: 'Kisumu, Kenya',
    countryCodes: ['KE'],
    videoUrl: 'https://vimeo.com/76979871',
    instruments: ['donation', 'reward_crowdfunding', 'love_money', 'equity'],
    opensCapital: true,
    tiers: [
      { threshold: 4_000, description: 'Premier kiosque' },
      { threshold: 12_000, description: 'Trois kiosques' },
      { threshold: 24_000, description: 'Six kiosques et un véhicule de maintenance' },
    ],
    durationDays: 60,
    rewards: [
      {
        title: 'Votre nom sur un kiosque',
        description: 'Votre nom sur la plaque d’un kiosque.',
        minAmount: 500,
        instruments: ['donation', 'reward_crowdfunding'],
        quantity: 6,
      },
    ],
    publishedDaysAgo: 3,
    followers: ['fatou'],
  },
  {
    key: 'ecole-segou',
    owner: 'moussa',
    title: 'École numérique itinérante à Ségou',
    summary: 'Un camion-école équipé de tablettes pour les villages autour de Ségou.',
    description:
      '## Le camion-école\n\nDeux animateurs, vingt tablettes, une tournée de dix villages.',
    sectorCode: 'education',
    impactArea: 'Région de Ségou, Mali',
    countryCodes: ['ML'],
    gallery: [{ hue: 265, alt: 'Image abstraite de démonstration, tons violets.' }],
    instruments: ['donation', 'grant'],
    tiers: [
      { threshold: 15_000, description: 'Camion et aménagement' },
      { threshold: 22_000, description: 'Tablettes et contenus' },
    ],
    durationDays: 90,
  },
  {
    key: 'teleconsultation-kivu',
    owner: 'rodrigue',
    title: 'Télé-consultations pour les centres de santé du Kivu',
    summary: 'Relier six centres de santé ruraux à des médecins de Goma.',
    sectorCode: 'health_social_work',
    countryCodes: ['CD'],
  },
];
