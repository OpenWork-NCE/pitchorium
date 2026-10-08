import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { DiscoveryKind } from '@pitchorium/contracts';
import { translate } from '@pitchorium/i18n';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { EventsFacade } from '../../events';
import { MissionsFacade } from '../../missions';
import { OrganizationsFacade } from '../../organizations';
import { ProfilesFacade, type ProfileSource } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import { type MatchProfileRecord, matchProfileOf } from '../domain/match-profile';
import {
  eventDocuments,
  missionDocuments,
  organizationDocuments,
  type PersonSource,
  personDocuments,
  projectDocuments,
  type SearchDocument,
  tagValues,
} from '../domain/search-documents';
import { DiscoveryRepository, type IndexedDocument } from './ports';

/** Languages whose labels of sectors, countries and hats are indexed (weight D, ADR 0066). */
const LABEL_LOCALES = ['fr', 'en'] as const;

/** What a source gives: its documents, and for a member their matching attributes. */
export interface Expected {
  documents: IndexedDocument[];
  matchProfile: MatchProfileRecord | null;
}

export function personSourceOf(profile: ProfileSource): PersonSource {
  const e = profile.entrepreneur;
  const c = profile.contributor;
  return {
    userId: profile.userId,
    handle: profile.handle,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    countryCode: profile.countryCode,
    city: profile.city,
    languages: profile.languages,
    publicPageEnabled: profile.visibility.publicPageEnabled,
    entrepreneurVisibility: profile.visibility.entrepreneurDetails,
    contributorVisibility: profile.visibility.contributorDetails,
    entrepreneur: e
      ? {
          companyName: e.companyName,
          sectorCode: e.sectorCode,
          stageCode: e.stageCode,
          companyCountryCode: e.companyCountryCode,
          companyCity: e.companyCity,
          pitch: e.pitch,
          needs: e.needs,
          soughtExpertise: e.soughtExpertise,
          fundingTarget: e.fundingTarget
            ? {
                amountMinor: BigInt(e.fundingTarget.amountMinor),
                currency: e.fundingTarget.currency,
              }
            : null,
        }
      : null,
    contributor: c
      ? {
          hats: c.hats,
          structureType: c.structureType,
          organizationName: c.organizationName,
          interventionCountryCodes: c.interventionCountryCodes,
          sectorCodes: c.sectorCodes,
          ticket: c.ticket
            ? {
                minMinor: BigInt(c.ticket.minAmountMinor),
                maxMinor: BigInt(c.ticket.maxAmountMinor),
                currency: c.ticket.currency,
              }
            : null,
          acceptedInstruments: c.acceptedInstruments,
          mentoringAvailable: c.mentoringAvailable,
          openToExpertMissions: c.openToExpertMissions,
        }
      : null,
  };
}

/**
 * Builds the search projection (ADR 0065) from the facades of the modules that own the data:
 * one document per audience, the labels of its codes in French and English, a fingerprint of
 * its content. An entity that is no longer indexable (draft, deleted, moderated) leaves the
 * index and every list of suggestions.
 */
@Injectable()
export class IndexerService {
  constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly projects: ProjectsFacade,
    private readonly events: EventsFacade,
    private readonly missions: MissionsFacade,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /** Reindexes the entities; returns those removed from the index. */
  async reindex(kind: DiscoveryKind, ids: readonly string[]): Promise<{ removed: string[] }> {
    if (ids.length === 0) return { removed: [] };
    const expected = await this.expected(kind, ids);
    const removed: string[] = [];
    await this.transactions.run(async () => {
      const now = this.clock.now();
      for (const id of new Set(ids)) {
        const found = expected.get(id);
        if (found && found.documents.length > 0) {
          await this.discovery.replaceDocuments(kind, id, found.documents, now);
        } else if (await this.discovery.deleteDocuments(kind, id)) {
          removed.push(id);
          await this.discovery.removeCandidate(kind, id);
        }
        if (kind === 'person') {
          if (found?.matchProfile) await this.discovery.upsertMatchProfile(found.matchProfile, now);
          else await this.discovery.deleteMatchProfile(id);
        }
      }
    });
    return { removed };
  }

  /** What the index should hold for these entities, read from their modules. */
  async expected(kind: DiscoveryKind, ids: readonly string[]): Promise<Map<string, Expected>> {
    const result = new Map<string, Expected>();
    const put = (
      id: string,
      documents: SearchDocument[],
      matchProfile: MatchProfileRecord | null,
    ) =>
      result.set(id, {
        documents: documents.map((document) => this.indexed(document)),
        matchProfile,
      });
    switch (kind) {
      case 'person':
        for (const profile of await this.profiles.sources(ids)) {
          const source = personSourceOf(profile);
          put(profile.userId, personDocuments(source), matchProfileOf(source));
        }
        break;
      case 'organization':
        for (const source of await this.organizations.discoverySources(ids)) {
          put(source.id, organizationDocuments(source), null);
        }
        break;
      case 'project':
        for (const source of await this.projects.discoverySources(ids)) {
          put(source.id, projectDocuments(source), null);
        }
        break;
      case 'event':
        for (const source of await this.events.discoverySources(ids)) {
          put(source.id, eventDocuments(source), null);
        }
        break;
      case 'mission':
        for (const source of await this.missions.discoverySources(ids)) {
          put(source.id, missionDocuments(source), null);
        }
        break;
    }
    return result;
  }

  /** Ids of every source entity of a kind, by ascending id (full rebuild, drift check). */
  sourceIdsAfter(kind: DiscoveryKind, after: string | null, limit: number): Promise<string[]> {
    switch (kind) {
      case 'person':
        return this.profiles.userIdsAfter(after, limit);
      case 'organization':
        return this.organizations.idsAfter(after, limit);
      case 'project':
        return this.projects.idsAfter(after, limit);
      case 'event':
        return this.events.idsAfter(after, limit);
      case 'mission':
        return this.missions.idsAfter(after, limit);
    }
  }

  /** Fingerprint of the documents of an entity, audiences in a stable order. */
  static fingerprintOf(documents: readonly IndexedDocument[]): string {
    return [...documents]
      .sort((a, b) => a.audience.localeCompare(b.audience))
      .map((document) => document.fingerprint)
      .join(',');
  }

  private indexed(document: SearchDocument): IndexedDocument {
    const labels = this.labelsOf(document);
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({ ...document, labels }, (_, value: unknown) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      )
      .digest('hex')
      .slice(0, 32);
    return { ...document, labels, fingerprint };
  }

  /** Labels of sectors, countries and hats in French and English, so that words find codes. */
  private labelsOf(document: SearchDocument): string {
    const labels = new Set<string>();
    for (const locale of LABEL_LOCALES) {
      for (const code of document.sectorCodes) {
        labels.add(translate(locale, 'reference', `sectors.${code}`));
      }
      for (const code of document.countryCodes) {
        labels.add(translate(locale, 'reference', `countries.${code}`));
      }
      for (const hat of tagValues(document.tags, 'hat')) {
        labels.add(translate(locale, 'reference', `contributorHats.${hat}`));
      }
    }
    return [...labels].join(' ');
  }
}
