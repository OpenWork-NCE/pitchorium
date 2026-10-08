import { Injectable } from '@nestjs/common';
import type {
  ContributorHat,
  DiscoveryCard,
  EventFormat,
  MissionDirection,
  MissionMode,
  ProjectStatus,
  StructureType,
  TimeEntryKind,
} from '@pitchorium/contracts';
import { EventsFacade } from '../../events';
import { OrganizationsFacade } from '../../organizations';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import { tagValues } from '../domain/search-documents';
import type { StoredDocument } from './ports';

const ids = (documents: readonly StoredDocument[], kind: StoredDocument['kind']) =>
  documents.filter((document) => document.kind === kind).map((document) => document.entityId);

/**
 * Cards of the search, the suggestions and the Discover page, in the order of the documents:
 * the indexed text and attributes, plus the image read from the module that owns it (a
 * private image is a short presigned URL). A member hidden from the reader is left out.
 */
@Injectable()
export class CardsService {
  constructor(
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly projects: ProjectsFacade,
    private readonly events: EventsFacade,
  ) {}

  async cards(
    documents: readonly StoredDocument[],
    viewerId: string | null,
  ): Promise<DiscoveryCard[]> {
    return (await this.aligned(documents, viewerId)).filter((card) => card !== null);
  }

  /** One card per document, in its order; null for a member hidden from the reader. */
  async aligned(
    documents: readonly StoredDocument[],
    viewerId: string | null,
  ): Promise<(DiscoveryCard | null)[]> {
    const [members, organizations, covers, events] = await Promise.all([
      this.profiles.memberCards(ids(documents, 'person'), viewerId),
      this.organizations.cards(ids(documents, 'organization')),
      this.projects.coverImages(ids(documents, 'project')),
      this.events.cards(ids(documents, 'event')),
    ]);
    return documents.map((document): DiscoveryCard | null => {
      const base = {
        key: document.key,
        title: document.name,
        subtitle: document.subtitle,
        countryCodes: document.countryCodes,
        sectorCodes: document.sectorCodes,
      };
      const tags = document.tags;
      switch (document.kind) {
        case 'person': {
          const card = members.get(document.entityId);
          if (!card) return null;
          return {
            kind: 'person',
            ...base,
            key: card.handle,
            imageUrl: card.avatarUrl,
            facets: {
              entrepreneur: tags.includes('facet:entrepreneur'),
              contributor: tags.includes('facet:contributor'),
            },
            hats: tagValues(tags, 'hat') as ContributorHat[],
          };
        }
        case 'organization':
          return {
            kind: 'organization',
            ...base,
            imageUrl: organizations.get(document.entityId)?.logoUrl ?? null,
            structureType: tagValues(tags, 'structure')[0] as StructureType,
            verified: tags.includes('verified'),
          };
        case 'project':
          return {
            kind: 'project',
            ...base,
            imageUrl: covers.get(document.entityId) ?? null,
            status: document.status as ProjectStatus,
            impactScore: document.impactScore,
            endsAt: document.endsAt?.toISOString() ?? null,
          };
        case 'event':
          return {
            kind: 'event',
            ...base,
            imageUrl: events.get(document.entityId)?.imageUrl ?? null,
            format: tagValues(tags, 'format')[0] as EventFormat,
            startsAt: (document.startsAt ?? new Date(0)).toISOString(),
            endsAt: (document.endsAt ?? new Date(0)).toISOString(),
            timeZone: tagValues(tags, 'tz')[0] ?? 'UTC',
          };
        case 'mission':
          return {
            kind: 'mission',
            ...base,
            imageUrl: null,
            direction: tagValues(tags, 'direction')[0] as MissionDirection,
            missionKind: tagValues(tags, 'kind')[0] as TimeEntryKind,
            mode: tagValues(tags, 'mode')[0] as MissionMode,
          };
      }
    });
  }
}
