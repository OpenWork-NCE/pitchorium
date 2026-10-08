import type { INestApplicationContext } from '@nestjs/common';
import type {
  CreateEventRequest,
  CreateMissionRequest,
  SuggestionList,
} from '@pitchorium/contracts';
import { suggestionSentenceText } from '@pitchorium/i18n';
import { IndexMaintenanceService } from '../../src/modules/discovery';
import { SuggestionsService } from '../../src/modules/discovery/application/suggestions.service';
import { EngagementService } from '../../src/modules/engagement/application/engagement.service';
import { EventEventsRecorder } from '../../src/modules/events/application/event-events.recorder';
import { EventsMaintenanceService } from '../../src/modules/events/application/events-maintenance.service';
import { EventsService } from '../../src/modules/events/application/events.service';
import { EventsRepository } from '../../src/modules/events/application/ports';
import { RegistrationsService } from '../../src/modules/events/application/registrations.service';
import { slugBaseFromTitle } from '../../src/modules/events/domain/event';
import { MissionsService } from '../../src/modules/missions/application/missions.service';
import { MissionsRepository } from '../../src/modules/missions/application/ports';
import { TransactionManager } from '../../src/platform/database';
import type { FixedClock } from '../../src/platform/kernel/clock';
import { demoId } from './seed-dev-data';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface DevDiscoveryResult {
  events: number;
  registrations: number;
  missions: number;
  missionEngagements: number;
  indexedSources: number;
  suggestionSubjects: number;
}

interface DemoEvent {
  organizer: string;
  organization?: string;
  /** Days from now to the start; negative for a past event. */
  inDays: number;
  hours: number;
  request: Omit<CreateEventRequest, 'startsAt' | 'endsAt' | 'organizationId' | 'projectId'>;
  /** Registered in this order: beyond the capacity, the waiting list. */
  attendees: string[];
}

/** A past event, an upcoming one full with a waiting list, an upcoming public webinar. */
const EVENTS: readonly DemoEvent[] = [
  {
    organizer: 'aissatou',
    inDays: -20,
    hours: 3,
    request: {
      title: 'Rencontre des coopératives maraîchères de Thiès',
      description:
        '## Programme\n\nRetours de saison sèche, **pompage solaire** et accès au crédit de campagne.',
      format: 'in_person',
      timeZone: 'Africa/Dakar',
      location: {
        name: 'Maison des coopératives',
        address: null,
        city: 'Thiès',
        countryCode: 'SN',
      },
      onlineUrl: null,
      language: 'fr',
      sectorCodes: ['agriculture_forestry_fishing'],
      countryCodes: ['SN'],
      imageMediaId: null,
      capacity: 40,
      visibility: 'members',
    },
    attendees: ['kofi', 'moussa', 'marieclaire'],
  },
  {
    organizer: 'kofi',
    inDays: 10,
    hours: 2,
    request: {
      title: 'Atelier : préparer sa première levée de fonds',
      description:
        'Un atelier pratique en petit comité : **tableau de financement**, ticket, calendrier.',
      format: 'hybrid',
      timeZone: 'Africa/Accra',
      location: { name: 'Impact Hub Accra', address: null, city: 'Accra', countryCode: 'GH' },
      onlineUrl: 'https://meet.example.org/levee-de-fonds',
      language: 'en',
      sectorCodes: ['agriculture_forestry_fishing', 'information_communication'],
      countryCodes: ['GH', 'SN'],
      imageMediaId: null,
      capacity: 3,
      visibility: 'members',
    },
    attendees: ['aissatou', 'ama', 'samuel', 'grace', 'rodrigue'],
  },
  {
    organizer: 'nadia',
    organization: 'teranga',
    inDays: 25,
    hours: 1.5,
    request: {
      title: 'Webinaire : mécénat de compétences et diaspora',
      description: 'Comment la diaspora accompagne les entrepreneurs, sans billetterie ni frais.',
      format: 'online',
      timeZone: 'Europe/Paris',
      location: null,
      onlineUrl: 'https://meet.example.org/mecenat-diaspora',
      language: 'fr',
      sectorCodes: ['education'],
      countryCodes: ['SN', 'CI', 'HT'],
      imageMediaId: null,
      capacity: null,
      visibility: 'public',
    },
    attendees: ['thierry', 'claudine'],
  },
];

type DemoMission = Omit<CreateMissionRequest, 'direction'> & {
  key: string;
  direction: 'offer' | 'request';
  author: string;
};

const MISSION_BASE = {
  sectorCodes: ['agriculture_forestry_fishing'],
  countryCodes: [] as string[],
  languages: ['fr'],
  capacity: 1,
  skills: [] as string[],
  desiredBy: null,
  visibility: 'members' as const,
  projectId: null,
};

const MISSIONS: readonly DemoMission[] = [
  {
    ...MISSION_BASE,
    key: 'financial-review',
    direction: 'offer',
    author: 'thierry',
    title: 'Revue de votre plan de financement',
    description:
      'Deux sessions pour relire votre plan, vos hypothèses et votre calendrier de levée.',
    kind: 'expertise',
    domain: 'Finance',
    format: 'session',
    estimatedHours: 4,
    mode: 'remote',
    capacity: 2,
  },
  {
    ...MISSION_BASE,
    key: 'export-mentoring',
    direction: 'offer',
    author: 'koffi',
    title: 'Mentorat export vers la CEDEAO',
    description: 'Un mois de points hebdomadaires pour structurer vos premiers contrats export.',
    kind: 'mentoring',
    domain: 'Commerce international',
    format: 'short_mission',
    estimatedHours: 12,
    mode: 'remote',
    sectorCodes: ['agriculture_forestry_fishing', 'manufacturing'],
  },
  {
    ...MISSION_BASE,
    key: 'distribution-request',
    direction: 'request',
    author: 'aissatou',
    title: 'Structurer la distribution des kits solaires',
    description: 'Nous cherchons un regard expérimenté sur notre réseau de revendeurs ruraux.',
    kind: 'mentoring',
    domain: 'Distribution',
    format: 'short_mission',
    estimatedHours: 10,
    mode: 'on_site',
    countryCodes: ['SN'],
    skills: ['Distribution rurale', 'Location-vente'],
    desiredBy: '2026-12-15',
  },
];

/**
 * Events, missions and the search index (ADR 0035): written through the services of the
 * events, missions and engagement modules, then the projection of discovery is rebuilt from
 * the facades and the suggestions computed. A second run creates nothing new.
 */
export async function seedDevDiscovery(
  context: INestApplicationContext,
  clock: FixedClock,
  now: Date = new Date(),
): Promise<DevDiscoveryResult> {
  const get = <T>(type: abstract new (...args: never[]) => T): T =>
    context.get<T>(type, { strict: false });
  const userId = (key: string) => demoId(`member:${key}`);
  const result: DevDiscoveryResult = {
    events: 0,
    registrations: 0,
    missions: 0,
    missionEngagements: 0,
    indexedSources: 0,
    suggestionSubjects: 0,
  };
  const events = get(EventsService);
  const registrations = get(RegistrationsService);
  const eventsRepository = get(EventsRepository);

  for (const demo of EVENTS) {
    if (await eventsRepository.resolveSlug(slugBaseFromTitle(demo.request.title))) continue;
    // Created and registered before its start, as real use would.
    const start = new Date(now.getTime() + demo.inDays * DAY_MS);
    clock.set(new Date(Math.min(now.getTime(), start.getTime()) - 15 * DAY_MS));
    const event = await events.create(userId(demo.organizer), {
      ...demo.request,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + demo.hours * HOUR_MS).toISOString(),
      organizationId: demo.organization ? demoId(`organization:${demo.organization}`) : null,
      projectId: null,
    });
    await events.publish(event.id);
    result.events += 1;
    for (const attendee of demo.attendees) {
      await registrations.register(event.id, userId(attendee), attendee !== 'rodrigue');
      result.registrations += 1;
    }
  }
  // The past event is completed, as the scheduled task of the worker does.
  clock.set(now);
  await new EventsMaintenanceService(
    eventsRepository,
    get(EventEventsRecorder),
    get(TransactionManager),
    clock,
  ).completeEnded();

  const missions = get(MissionsService);
  const missionsRepository = get(MissionsRepository);
  const created = new Map<string, string>();
  clock.set(new Date(now.getTime() - 12 * DAY_MS));
  for (const demo of MISSIONS) {
    const { key, direction, author, ...request } = demo;
    const existing = (await missionsRepository.authoredBy(userId(author), null, 50)).find(
      (mission) => mission.title === request.title,
    );
    if (existing) {
      created.set(key, existing.id);
      continue;
    }
    const mission = await missions.create(userId(author), direction, request);
    created.set(key, mission.id);
    result.missions += 1;
  }

  // A completed mission: solicited, accepted, completed with its hours, confirmed.
  const reviewId = created.get('financial-review');
  const marieclaire = userId('marieclaire');
  if (reviewId) {
    const mine = await missionsRepository.engagementsOfMember(marieclaire, [reviewId]);
    if (!mine.has(reviewId)) {
      clock.set(new Date(now.getTime() - 10 * DAY_MS));
      const engagement = await missions.request(reviewId, marieclaire, {
        message: 'Bonjour Thierry, pouvez-vous relire notre plan de financement du centre ?',
        projectId: null,
      });
      clock.set(new Date(now.getTime() - 9 * DAY_MS));
      await missions.answer(engagement.id, 'accepted', 'Avec plaisir, à jeudi.');
      clock.set(new Date(now.getTime() - 3 * DAY_MS));
      await missions.complete(engagement.id, {
        minutes: 120,
        date: new Date(now.getTime() - 4 * DAY_MS).toISOString().slice(0, 10),
        description: 'Deux sessions de revue du plan de financement',
      });
      const done = await missionsRepository.findEngagement(engagement.id);
      if (done?.timeEntryId) {
        await get(EngagementService).respond(done.timeEntryId, marieclaire, 'confirmed');
      }
      result.missionEngagements += 1;
    }
  }
  // An application waiting for an answer.
  const requestId = created.get('distribution-request');
  if (requestId) {
    const pending = await missionsRepository.engagementsOfMember(userId('koffi'), [requestId]);
    if (!pending.has(requestId)) {
      clock.set(new Date(now.getTime() - 2 * DAY_MS));
      await missions.request(requestId, userId('koffi'), {
        message: 'J’ai monté un réseau de revendeurs au Togo, je peux vous aider.',
        projectId: null,
      });
      result.missionEngagements += 1;
    }
  }

  // The search projection and the suggestions, from the facades.
  clock.set(now);
  const rebuilt = await get(IndexMaintenanceService).rebuild();
  result.indexedSources = rebuilt.indexed;
  result.suggestionSubjects = rebuilt.subjects;
  return result;
}

/** Explained suggestions of a few demo members, to check them at the end of the seed. */
export async function sampleSuggestions(context: INestApplicationContext): Promise<string[]> {
  const suggestions = context.get(SuggestionsService, { strict: false });
  const samples: [string, SuggestionList][] = [
    ['aissatou', 'people'],
    ['kofi', 'projects'],
    ['jeanbaptiste', 'complementary_entrepreneurs'],
    ['marieclaire', 'missions'],
  ];
  const lines: string[] = [];
  for (const [key, list] of samples) {
    const page = await suggestions.list(demoId(`member:${key}`), list, { limit: 1 });
    const first = page.items[0];
    lines.push(
      first
        ? `${key} (${list}): ${first.candidate.title}, ${suggestionSentenceText('fr', first.sentence)}`
        : `${key} (${list}): no suggestion`,
    );
  }
  return lines;
}
