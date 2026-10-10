/**
 * Demonstration data for the development of the web application: fictitious people and
 * organizations in the contexts of the cahier des charges (Africa, Caribbean, diaspora).
 * Every name, company and figure is invented; emails use the reserved `.test` domain.
 */

export interface DemoMember {
  key: string;
  name: string;
  handle: string;
  headline: string;
  bio: string;
  countryCode: string;
  city: string;
  languages: string[];
  locale: 'fr' | 'en';
  publicPage: boolean;
  /** Hue of the generated photo and cover. */
  hue: number;
  entrepreneur?: {
    companyName: string;
    sectorCode: string;
    stageCode: string;
    companyCountryCode: string;
    companyCity: string;
    teamSize: number;
    foundedYear: number;
    pitch: string;
    needs: string[];
    fundingTarget?: { amountMinor: bigint; currency: string };
  };
  contributor?: {
    hats: string[];
    structureType: string;
    organizationKey?: string;
    interventionCountryCodes: string[];
    sectorCodes: string[];
    ticket?: { min: bigint; max: bigint; currency: string };
    acceptedInstruments: string[];
    patronageTypes: string[];
    mentoringAvailable: boolean;
    openToExpertMissions: boolean;
  };
}

export const DEMO_MEMBERS: readonly DemoMember[] = [
  {
    key: 'aissatou',
    name: 'Aïssatou Ba',
    handle: 'aissatou-ba',
    headline: 'Fondatrice de Sahel Agri, irrigation solaire pour les maraîchères',
    bio: "Ingénieure agronome formée à Saint-Louis, j'accompagne depuis six ans des coopératives de maraîchères de la vallée du fleuve Sénégal.",
    countryCode: 'SN',
    city: 'Dakar',
    languages: ['fr', 'wo', 'en'],
    locale: 'fr',
    publicPage: true,
    hue: 28,
    entrepreneur: {
      companyName: 'Sahel Agri',
      sectorCode: 'agriculture_forestry_fishing',
      stageCode: 'prototype',
      companyCountryCode: 'SN',
      companyCity: 'Thiès',
      teamSize: 7,
      foundedYear: 2023,
      pitch:
        'Des kits de pompage solaire en location-vente pour les coopératives de maraîchères, payables au rythme des récoltes.',
      needs: ['funding', 'mentoring', 'business_partnership'],
      fundingTarget: { amountMinor: 7_500_000n, currency: 'EUR' },
    },
  },
  {
    key: 'kofi',
    name: 'Kofi Mensah',
    handle: 'kofi-mensah',
    headline: 'Business angel, ancien directeur financier dans les télécoms',
    bio: 'Après vingt ans en finance d’entreprise entre Accra et Londres, j’investis et je mentore des fondateurs de la région.',
    countryCode: 'GH',
    city: 'Accra',
    languages: ['en', 'fr', 'ak'],
    locale: 'en',
    publicPage: true,
    hue: 210,
    contributor: {
      hats: ['investor', 'mentor'],
      structureType: 'individual',
      interventionCountryCodes: ['GH', 'CI', 'SN', 'NG'],
      sectorCodes: ['agriculture_forestry_fishing', 'finance_insurance', 'energy'],
      ticket: { min: 1_000_000n, max: 5_000_000n, currency: 'EUR' },
      acceptedInstruments: ['equity', 'convertible_bonds'],
      patronageTypes: [],
      mentoringAvailable: true,
      openToExpertMissions: false,
    },
  },
  {
    key: 'ama',
    name: 'Ama Owusu',
    handle: 'ama-owusu',
    headline: 'CEO of Kente Digital, e-commerce for West African artisans',
    bio: 'We help weavers from Bonwire sell to the diaspora, with fair prices and tracked delivery.',
    countryCode: 'GH',
    city: 'Kumasi',
    languages: ['en', 'ak'],
    locale: 'en',
    publicPage: true,
    hue: 300,
    entrepreneur: {
      companyName: 'Kente Digital',
      sectorCode: 'information_communication',
      stageCode: 'early_revenue',
      companyCountryCode: 'GH',
      companyCity: 'Kumasi',
      teamSize: 12,
      foundedYear: 2021,
      pitch:
        'A marketplace and a logistics partner network for artisans, with mobile money payouts.',
      needs: ['funding', 'expertise'],
      fundingTarget: { amountMinor: 25_000_000n, currency: 'EUR' },
    },
  },
  {
    key: 'jeanbaptiste',
    name: 'Jean-Baptiste Kouassi',
    handle: 'jean-baptiste-kouassi',
    headline: 'Cofondateur de CacaoTrace, traçabilité du cacao de la parcelle au port',
    bio: 'Fils de planteur à Soubré, je construis des outils simples pour prouver l’origine du cacao et mieux rémunérer les producteurs.',
    countryCode: 'CI',
    city: 'Abidjan',
    languages: ['fr', 'en'],
    locale: 'fr',
    publicPage: false,
    hue: 20,
    entrepreneur: {
      companyName: 'CacaoTrace',
      sectorCode: 'agriculture_forestry_fishing',
      stageCode: 'growth',
      companyCountryCode: 'CI',
      companyCity: 'Soubré',
      teamSize: 18,
      foundedYear: 2020,
      pitch:
        'Une application hors ligne et des étiquettes QR pour la traçabilité exigée par le règlement européen sur la déforestation.',
      needs: ['funding', 'business_partnership', 'recruitment'],
      fundingTarget: { amountMinor: 50_000_000n, currency: 'EUR' },
    },
  },
  {
    key: 'marieclaire',
    name: 'Marie-Claire Joseph',
    handle: 'marie-claire-joseph',
    headline: 'Fondatrice de Kreyòl Solar, électricité solaire pour les écoles haïtiennes',
    bio: 'Ingénieure électricienne revenue de Montréal, je veux que chaque école de l’Artibonite ait de la lumière et internet.',
    countryCode: 'HT',
    city: 'Port-au-Prince',
    languages: ['fr', 'ht', 'en'],
    locale: 'fr',
    publicPage: true,
    hue: 50,
    entrepreneur: {
      companyName: 'Kreyòl Solar',
      sectorCode: 'energy',
      stageCode: 'idea',
      companyCountryCode: 'HT',
      companyCity: 'Saint-Marc',
      teamSize: 3,
      foundedYear: 2025,
      pitch: 'Des micro-centrales solaires mutualisées entre écoles et commerces de quartier.',
      needs: ['donation', 'mentoring', 'expertise'],
    },
  },
  {
    key: 'thierry',
    name: 'Thierry Lacroix',
    handle: 'thierry-lacroix',
    headline: 'Expert-comptable, président de Diaspora Invest Caraïbes',
    bio: 'Martiniquais, j’anime un club d’investisseurs de la diaspora caribéenne et j’accompagne les porteurs sur leur modèle financier.',
    countryCode: 'MQ',
    city: 'Fort-de-France',
    languages: ['fr', 'en'],
    locale: 'fr',
    publicPage: true,
    hue: 160,
    contributor: {
      hats: ['expert', 'mentor', 'investor'],
      structureType: 'company',
      organizationKey: 'diaspora-invest',
      interventionCountryCodes: ['HT', 'SN', 'CI'],
      sectorCodes: ['finance_insurance', 'energy', 'professional_scientific_technical'],
      ticket: { min: 500_000n, max: 2_000_000n, currency: 'EUR' },
      acceptedInstruments: ['equity', 'honor_loan'],
      patronageTypes: [],
      mentoringAvailable: true,
      openToExpertMissions: true,
    },
  },
  {
    key: 'nadia',
    name: 'Nadia Benali',
    handle: 'nadia-benali',
    headline: 'Déléguée générale de la Fondation Teranga',
    bio: 'Franco-sénégalaise, je dirige une fondation qui finance l’entrepreneuriat des jeunes femmes en Afrique de l’Ouest.',
    countryCode: 'FR',
    city: 'Paris',
    languages: ['fr', 'en', 'wo'],
    locale: 'fr',
    publicPage: true,
    hue: 340,
    contributor: {
      hats: ['patron_donor', 'mentor'],
      structureType: 'foundation',
      organizationKey: 'teranga',
      interventionCountryCodes: ['SN', 'ML', 'CI'],
      sectorCodes: ['education', 'agriculture_forestry_fishing'],
      acceptedInstruments: ['donation'],
      patronageTypes: ['financial', 'skills'],
      mentoringAvailable: true,
      openToExpertMissions: false,
    },
  },
  {
    key: 'samuel',
    name: 'Samuel Okafor',
    handle: 'samuel-okafor',
    headline: 'Founder of PayLink, cross-border payments for small merchants',
    bio: 'Former engineer at a Lagos bank. PayLink lets traders pay suppliers in Accra and Cotonou in minutes.',
    countryCode: 'NG',
    city: 'Lagos',
    languages: ['en', 'yo'],
    locale: 'en',
    publicPage: false,
    hue: 120,
    entrepreneur: {
      companyName: 'PayLink',
      sectorCode: 'finance_insurance',
      stageCode: 'early_revenue',
      companyCountryCode: 'NG',
      companyCity: 'Lagos',
      teamSize: 22,
      foundedYear: 2022,
      pitch: 'Instant supplier payments across ECOWAS borders, settled through mobile money.',
      needs: ['funding', 'recruitment'],
      fundingTarget: { amountMinor: 100_000_000n, currency: 'USD' },
    },
  },
  {
    key: 'grace',
    name: 'Grace Wanjiru',
    handle: 'grace-wanjiru',
    headline: 'Founder of Maji Safi, clean water kiosks in Nairobi',
    bio: 'Water engineer. Our kiosks sell safe water by the litre with mobile payments in informal settlements.',
    countryCode: 'KE',
    city: 'Nairobi',
    languages: ['en', 'sw'],
    locale: 'en',
    publicPage: true,
    hue: 190,
    entrepreneur: {
      companyName: 'Maji Safi',
      sectorCode: 'water_waste',
      stageCode: 'prototype',
      companyCountryCode: 'KE',
      companyCity: 'Nairobi',
      teamSize: 6,
      foundedYear: 2024,
      pitch: 'Solar-powered purification kiosks run by local women entrepreneurs.',
      needs: ['funding', 'donation', 'business_partnership'],
      fundingTarget: { amountMinor: 1_200_000_000n, currency: 'KES' },
    },
  },
  {
    key: 'moussa',
    name: 'Moussa Diarra',
    handle: 'moussa-diarra',
    headline: 'Porteur du projet École Numérique, tablettes hors ligne pour les écoles rurales',
    bio: 'Instituteur pendant dix ans à Ségou, je conçois des contenus pédagogiques en bambara et en français.',
    countryCode: 'ML',
    city: 'Bamako',
    languages: ['fr', 'bm'],
    locale: 'fr',
    publicPage: false,
    hue: 260,
    entrepreneur: {
      companyName: 'École Numérique',
      sectorCode: 'education',
      stageCode: 'idea',
      companyCountryCode: 'ML',
      companyCity: 'Ségou',
      teamSize: 2,
      foundedYear: 2025,
      pitch: 'Des tablettes solaires préchargées de leçons bilingues, partagées entre écoles.',
      needs: ['donation', 'mentoring'],
    },
  },
  {
    key: 'fatou',
    name: 'Fatou Sow',
    handle: 'fatou-sow',
    headline: 'Investisseuse d’impact, membre de Diaspora Invest Caraïbes',
    bio: 'Analyste financière à Bruxelles, j’investis à titre personnel dans l’agroalimentaire et l’énergie en Afrique de l’Ouest.',
    countryCode: 'BE',
    city: 'Bruxelles',
    languages: ['fr', 'en', 'wo'],
    locale: 'fr',
    publicPage: false,
    hue: 0,
    contributor: {
      hats: ['investor'],
      structureType: 'individual',
      organizationKey: 'diaspora-invest',
      interventionCountryCodes: ['SN', 'CI', 'GH'],
      sectorCodes: ['agriculture_forestry_fishing', 'energy'],
      ticket: { min: 200_000n, max: 1_000_000n, currency: 'EUR' },
      acceptedInstruments: ['equity', 'donation'],
      patronageTypes: [],
      mentoringAvailable: false,
      openToExpertMissions: false,
    },
  },
  {
    key: 'rodrigue',
    name: 'Rodrigue Mbemba',
    handle: 'rodrigue-mbemba',
    headline: 'Médecin, fondateur de MboteSanté, téléconsultation à Kinshasa',
    bio: 'Urgentiste, je relie les centres de santé des quartiers périphériques à des médecins par téléphone.',
    countryCode: 'CD',
    city: 'Kinshasa',
    languages: ['fr', 'ln'],
    locale: 'fr',
    publicPage: false,
    hue: 100,
    entrepreneur: {
      companyName: 'MboteSanté',
      sectorCode: 'health_social_work',
      stageCode: 'prototype',
      companyCountryCode: 'CD',
      companyCity: 'Kinshasa',
      teamSize: 5,
      foundedYear: 2024,
      pitch:
        'Une ligne de téléconsultation et un carnet de santé partagé pour les centres de quartier.',
      needs: ['funding', 'expertise'],
      fundingTarget: { amountMinor: 15_000_000n, currency: 'EUR' },
    },
  },
  {
    key: 'claudine',
    name: 'Claudine Pierre-Louis',
    handle: 'claudine-pierre-louis',
    headline: 'Directrice d’incubateur en Guadeloupe, mentore en stratégie commerciale',
    bio: 'J’accompagne les entreprises caribéennes qui veulent s’ouvrir aux marchés africains.',
    countryCode: 'GP',
    city: 'Pointe-à-Pitre',
    languages: ['fr', 'en'],
    locale: 'fr',
    publicPage: true,
    hue: 230,
    contributor: {
      hats: ['mentor', 'business_partner'],
      structureType: 'institution',
      organizationKey: 'diaspora-invest',
      interventionCountryCodes: ['HT', 'SN', 'CM'],
      sectorCodes: ['trade', 'professional_scientific_technical'],
      acceptedInstruments: [],
      patronageTypes: ['skills'],
      mentoringAvailable: true,
      openToExpertMissions: true,
    },
  },
  {
    key: 'koffi',
    name: 'Koffi Agbodjan',
    handle: 'koffi-agbodjan',
    headline: 'Responsable de programme, Réseau des femmes entrepreneures du Sahel',
    bio: 'Je coordonne les formations et le mentorat du réseau entre Dakar, Bamako et Niamey.',
    countryCode: 'TG',
    city: 'Lomé',
    languages: ['fr', 'ee'],
    locale: 'fr',
    publicPage: false,
    hue: 75,
    contributor: {
      hats: ['mentor', 'expert'],
      structureType: 'ngo_association',
      organizationKey: 'femmes-sahel',
      interventionCountryCodes: ['SN', 'ML', 'NE'],
      sectorCodes: ['education', 'agriculture_forestry_fishing'],
      acceptedInstruments: [],
      patronageTypes: ['skills'],
      mentoringAvailable: true,
      openToExpertMissions: true,
    },
  },
];

export interface DemoOrganization {
  key: string;
  slug: string;
  name: string;
  structureType: string;
  description: string;
  countryCodes: string[];
  sectorCodes: string[];
  websiteUrl: string;
  foundedYear: number;
  hue: number;
  owner: string;
  admins: string[];
  members: string[];
}

export const DEMO_ORGANIZATIONS: readonly DemoOrganization[] = [
  {
    key: 'teranga',
    slug: 'fondation-teranga',
    name: 'Fondation Teranga',
    structureType: 'foundation',
    description:
      'Bourses, mentorat et dons en nature pour les jeunes femmes entrepreneures du Sénégal, du Mali et de Côte d’Ivoire.',
    countryCodes: ['SN', 'FR'],
    sectorCodes: ['education', 'agriculture_forestry_fishing'],
    websiteUrl: 'https://teranga.example.org',
    foundedYear: 2016,
    hue: 340,
    owner: 'nadia',
    // Jean-Baptiste carries the dryer of Soubré for the foundation (projects-dataset.ts).
    admins: ['jeanbaptiste'],
    members: ['aissatou'],
  },
  {
    key: 'diaspora-invest',
    slug: 'diaspora-invest-caraibes',
    name: 'Diaspora Invest Caraïbes',
    structureType: 'company',
    description:
      'Club d’investisseurs de la diaspora caribéenne et africaine : tickets de 2 000 à 20 000 euros, accompagnement financier.',
    countryCodes: ['MQ', 'GP', 'FR'],
    sectorCodes: ['finance_insurance', 'energy'],
    websiteUrl: 'https://diaspora-invest.example.com',
    foundedYear: 2019,
    hue: 160,
    owner: 'thierry',
    admins: ['claudine'],
    members: ['fatou'],
  },
  {
    key: 'femmes-sahel',
    slug: 'reseau-femmes-entrepreneures-sahel',
    name: 'Réseau des femmes entrepreneures du Sahel',
    structureType: 'ngo_association',
    description:
      'Association de 600 entrepreneures : formations, groupements d’achat et mentorat entre pairs.',
    countryCodes: ['SN', 'ML', 'NE'],
    sectorCodes: ['agriculture_forestry_fishing', 'trade'],
    websiteUrl: 'https://femmes-sahel.example.org',
    foundedYear: 2012,
    hue: 28,
    owner: 'aissatou',
    admins: ['koffi'],
    members: [],
  },
];

/** Accepted connections (both members follow each other). */
export const DEMO_CONNECTIONS: readonly [string, string][] = [
  ['aissatou', 'kofi'],
  ['aissatou', 'nadia'],
  ['aissatou', 'thierry'],
  ['aissatou', 'fatou'],
  ['aissatou', 'koffi'],
  ['kofi', 'ama'],
  ['kofi', 'jeanbaptiste'],
  ['kofi', 'samuel'],
  ['ama', 'samuel'],
  ['ama', 'grace'],
  ['jeanbaptiste', 'fatou'],
  ['marieclaire', 'thierry'],
  ['marieclaire', 'claudine'],
  ['thierry', 'claudine'],
  ['thierry', 'fatou'],
  ['nadia', 'moussa'],
  ['nadia', 'koffi'],
  ['grace', 'rodrigue'],
];

/** Unilateral follows of members and organizations. */
export const DEMO_FOLLOWS: readonly { follower: string; member?: string; organization?: string }[] =
  [
    { follower: 'moussa', member: 'aissatou' },
    { follower: 'moussa', member: 'kofi' },
    { follower: 'rodrigue', member: 'kofi' },
    { follower: 'marieclaire', member: 'aissatou' },
    { follower: 'grace', member: 'aissatou' },
    { follower: 'samuel', member: 'thierry' },
    { follower: 'jeanbaptiste', organization: 'diaspora-invest' },
    { follower: 'marieclaire', organization: 'teranga' },
    { follower: 'moussa', organization: 'teranga' },
    { follower: 'grace', organization: 'femmes-sahel' },
    { follower: 'aissatou', organization: 'diaspora-invest' },
    { follower: 'kofi', organization: 'teranga' },
  ];

/** Pending requests, to try the acceptance from the web application. */
export const DEMO_PENDING_REQUESTS: readonly { from: string; to: string; note: string }[] = [
  {
    from: 'moussa',
    to: 'aissatou',
    note: 'Nous nous sommes croisés au forum de Dakar sur l’agriculture durable. J’aimerais échanger sur vos kits solaires.',
  },
  {
    from: 'rodrigue',
    to: 'nadia',
    note: 'Votre fondation finance-t-elle aussi des projets de santé ?',
  },
];

export interface DemoPost {
  key: string;
  author: string;
  organization?: string;
  daysAgo: number;
  visibility: 'public' | 'members' | 'connections';
  text?: string;
  images?: number;
  /** Text alternatives of the images, in their order (§10.3, accessibility). */
  alts?: string[];
  /** A PDF of abstract pages (no text), under its title. */
  document?: { title: string; pages: number };
  link?: { url: string; title: string; description: string; siteName: string };
  repostOf?: string;
  featured?: boolean;
}

export const DEMO_POSTS: readonly DemoPost[] = [
  {
    key: 'sahel-harvest',
    author: 'aissatou',
    daysAgo: 1,
    visibility: 'public',
    text: 'Première récolte de la saison sèche à Thiès avec la coopérative de Keur Mbaye : 40 maraîchères, 3 pompes solaires, zéro litre de gasoil. Merci @kofi-mensah pour tes conseils sur le modèle de location-vente.',
    images: 2,
    alts: [
      'Rangées de laitues et de oignons sous des panneaux solaires, au lever du jour.',
      'Une maraîchère ouvre la vanne d’une pompe solaire au bord d’un bassin.',
    ],
    featured: true,
  },
  {
    key: 'kente-launch',
    author: 'ama',
    daysAgo: 2,
    visibility: 'public',
    text: 'Kente Digital now ships to 14 countries. Our weavers in Bonwire received their first mobile money payouts from customers in Paris and Atlanta this week.',
    images: 1,
  },
  {
    key: 'cacao-eudr',
    author: 'jeanbaptiste',
    daysAgo: 3,
    visibility: 'members',
    text: 'Le règlement européen contre la déforestation entre en application : nos 2 000 planteurs de Soubré sont déjà géolocalisés. Qui veut en parler avec nous ?',
    link: {
      url: 'https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en',
      title: 'Regulation on deforestation-free products',
      description:
        'EU rules to guarantee that the products EU citizens consume do not contribute to deforestation.',
      siteName: 'European Commission',
    },
  },
  {
    key: 'kreyol-call',
    author: 'marieclaire',
    daysAgo: 4,
    visibility: 'public',
    text: 'Nous cherchons trois écoles pilotes dans l’Artibonite pour nos micro-centrales solaires. Les directeurs intéressés peuvent me contacter.',
    images: 1,
  },
  {
    key: 'teranga-call',
    author: 'nadia',
    organization: 'teranga',
    daysAgo: 5,
    visibility: 'public',
    text: 'Appel à candidatures 2027 : 20 bourses de 5 000 euros et un an de mentorat pour des entrepreneures de moins de 35 ans au Sénégal, au Mali et en Côte d’Ivoire.',
    featured: true,
  },
  {
    key: 'paylink-hiring',
    author: 'samuel',
    daysAgo: 6,
    visibility: 'members',
    text: 'PayLink is hiring two backend engineers in Lagos. Experience with mobile money APIs is a big plus. DM me.',
  },
  {
    key: 'maji-safi',
    author: 'grace',
    daysAgo: 7,
    visibility: 'public',
    text: 'Tunafungua kioski ya tano ya maji safi huko Kibera wiki hii. Asanteni kwa msaada wenu wote!',
    images: 1,
  },
  {
    key: 'diaspora-club',
    author: 'thierry',
    organization: 'diaspora-invest',
    daysAgo: 8,
    visibility: 'members',
    text: 'Prochaine session du club le 15 novembre : trois projets de transition énergétique entre Haïti et le Sénégal. Les membres peuvent proposer leurs dossiers.',
  },
  {
    key: 'kofi-advice',
    author: 'kofi',
    daysAgo: 9,
    visibility: 'public',
    text: 'Three questions I ask every founder before investing: who pays, how often, and what happens when the dollar moves 20 %? Most pitch decks only answer the first one.',
  },
  {
    key: 'ecole-numerique',
    author: 'moussa',
    daysAgo: 10,
    visibility: 'members',
    text: 'Nos premières leçons de mathématiques en bambara sont prêtes. Nous cherchons des enseignants pour les tester à Ségou.',
  },
  {
    key: 'mbote-sante',
    author: 'rodrigue',
    daysAgo: 11,
    visibility: 'connections',
    text: 'Bilan du premier mois : 1 200 téléconsultations, dont 30 % la nuit. Les centres de Kimbanseke sont les plus demandeurs.',
  },
  {
    key: 'femmes-sahel-training',
    author: 'aissatou',
    organization: 'femmes-sahel',
    daysAgo: 12,
    visibility: 'public',
    text: 'Formation à la gestion financière pour 45 membres du réseau à Bamako la semaine prochaine, animée par @koffi-agbodjan.',
  },
  {
    key: 'fatou-repost',
    author: 'fatou',
    daysAgo: 1,
    visibility: 'members',
    text: 'Un modèle très convaincant, à suivre de près.',
    repostOf: 'sahel-harvest',
  },
  {
    key: 'claudine-repost',
    author: 'claudine',
    daysAgo: 4,
    visibility: 'members',
    text: 'Belle initiative caribéenne, je relaie.',
    repostOf: 'kreyol-call',
  },
  {
    key: 'kente-workshop',
    author: 'ama',
    daysAgo: 2,
    visibility: 'members',
    text: 'Three looms, three generations: a morning at the Bonwire workshop.',
    images: 3,
    alts: [
      'A weaver passes the shuttle through a narrow loom.',
      'Spools of yellow, green and red thread on a wooden shelf.',
      'Two finished kente strips laid side by side on a table.',
    ],
  },
  {
    key: 'maji-kiosks',
    author: 'grace',
    daysAgo: 3,
    visibility: 'public',
    text: 'Four kiosks, four neighbourhoods: the water network in pictures.',
    images: 4,
    alts: [
      'A blue water kiosk at a crossroads.',
      'Jerrycans lined up in front of a tap.',
      'A technician checks a filter.',
      'Children carry water home at dusk.',
    ],
  },
  {
    key: 'kofi-pitch-day',
    author: 'kofi',
    daysAgo: 5,
    visibility: 'public',
    text: 'Pitch day in Accra: five founders, five very different answers to the currency question.',
    images: 5,
    alts: [
      'A founder presents in front of a screen.',
      'The audience listens in a full room.',
      'A panel of four investors at a long table.',
      'Notes on a whiteboard about exchange rates.',
      'The founders together at the end of the day.',
    ],
  },
  {
    key: 'sahel-album',
    author: 'aissatou',
    organization: 'femmes-sahel',
    daysAgo: 6,
    visibility: 'members',
    text: 'L’album de la tournée des coopératives : neuf villages en deux semaines.',
    images: 9,
    alts: Array.from(
      { length: 9 },
      (_, index) => `Coopérative du village ${index + 1} de la tournée, vue d’ensemble.`,
    ),
  },
  {
    key: 'teranga-report',
    author: 'nadia',
    organization: 'teranga',
    daysAgo: 4,
    visibility: 'members',
    text: 'Le rapport de démonstration de la Fondation, pour essayer la lecture d’un document.',
    document: { title: 'Rapport de démonstration', pages: 6 },
  },
  {
    key: 'nadia-mentoring',
    author: 'nadia',
    daysAgo: 13,
    visibility: 'members',
    text: 'Je consacre deux heures par mois au mentorat de porteuses de projet. Les membres intéressées peuvent m’écrire.',
  },
];

export const DEMO_COMMENTS: readonly {
  key: string;
  post: string;
  author: string;
  text: string;
  replyTo?: string;
}[] = [
  {
    key: 'c1',
    post: 'sahel-harvest',
    author: 'kofi',
    text: 'Congratulations! What is the payback period for a cooperative?',
  },
  {
    key: 'c2',
    post: 'sahel-harvest',
    author: 'aissatou',
    text: 'Environ 18 mois, avec des mensualités alignées sur les récoltes.',
    replyTo: 'c1',
  },
  {
    key: 'c3',
    post: 'sahel-harvest',
    author: 'nadia',
    text: 'Bravo Aïssatou, la Fondation suit ce projet avec attention.',
  },
  {
    key: 'c4',
    post: 'kente-launch',
    author: 'samuel',
    text: 'Great milestone. Which payout corridor works best for you?',
  },
  {
    key: 'c5',
    post: 'kente-launch',
    author: 'ama',
    text: 'Mobile money to MTN wallets, settled the same day.',
    replyTo: 'c4',
  },
  {
    key: 'c6',
    post: 'cacao-eudr',
    author: 'fatou',
    text: 'Très intéressée, nous en parlons au prochain club ?',
  },
  {
    key: 'c7',
    post: 'kreyol-call',
    author: 'thierry',
    text: 'Je peux aider sur le modèle financier des micro-centrales.',
  },
  {
    key: 'c8',
    post: 'teranga-call',
    author: 'moussa',
    text: 'Les projets éducatifs sont-ils éligibles ?',
  },
  {
    key: 'c9',
    post: 'teranga-call',
    author: 'nadia',
    text: 'Oui, s’ils sont portés par une femme de moins de 35 ans.',
    replyTo: 'c8',
  },
  {
    key: 'c10',
    post: 'kofi-advice',
    author: 'grace',
    text: 'The currency question is the one investors ask us most.',
  },
  { key: 'c11', post: 'maji-safi', author: 'ama', text: 'Hongera Grace!' },
];

export const DEMO_REACTIONS: readonly {
  post?: string;
  comment?: string;
  author: string;
  type: string;
}[] = [
  { post: 'sahel-harvest', author: 'kofi', type: 'bravo' },
  { post: 'sahel-harvest', author: 'nadia', type: 'support' },
  { post: 'sahel-harvest', author: 'thierry', type: 'like' },
  { post: 'sahel-harvest', author: 'fatou', type: 'insightful' },
  { post: 'sahel-harvest', author: 'moussa', type: 'like' },
  { post: 'kente-launch', author: 'kofi', type: 'like' },
  { post: 'kente-launch', author: 'grace', type: 'bravo' },
  { post: 'kente-launch', author: 'samuel', type: 'bravo' },
  { post: 'cacao-eudr', author: 'fatou', type: 'insightful' },
  { post: 'cacao-eudr', author: 'kofi', type: 'insightful' },
  { post: 'kreyol-call', author: 'claudine', type: 'support' },
  { post: 'kreyol-call', author: 'thierry', type: 'support' },
  { post: 'teranga-call', author: 'aissatou', type: 'like' },
  { post: 'teranga-call', author: 'moussa', type: 'support' },
  { post: 'kofi-advice', author: 'ama', type: 'insightful' },
  { post: 'kofi-advice', author: 'samuel', type: 'insightful' },
  { post: 'kofi-advice', author: 'jeanbaptiste', type: 'like' },
  { post: 'maji-safi', author: 'ama', type: 'bravo' },
  { post: 'maji-safi', author: 'rodrigue', type: 'support' },
  { comment: 'c2', author: 'kofi', type: 'insightful' },
  { comment: 'c9', author: 'moussa', type: 'like' },
];
