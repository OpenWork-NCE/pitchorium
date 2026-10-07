import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type {
  CursorPage,
  CursorPageQuery,
  NetworkSettings,
  ProfileViewsSummary,
  ProfileVisit,
} from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { Clock, decodeCursor, encodeCursor } from '../../../platform/kernel';
import { type ProfileView, type ProfileViewListener, ProfilesFacade } from '../../profiles';
import { anonymizedSector, dayOf, windowStart } from '../domain/profile-views';
import { MemberDirectory } from './member-directory';
import { NetworkRepository, ProfileViewBuffer } from './ports';

/**
 * Profile views (§10.2, ADR 0030): reported by profiles without waiting, buffered and
 * deduplicated in Redis, written in batches by the worker. Private visits show an anonymized
 * mention to the visited member, never the visitor.
 */
@Injectable()
export class ProfileViewsService implements ProfileViewListener, OnModuleInit {
  private readonly logger = new Logger(ProfileViewsService.name);

  constructor(
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
    private readonly network: NetworkRepository,
    private readonly buffer: ProfileViewBuffer,
    private readonly profiles: ProfilesFacade,
    private readonly members: MemberDirectory,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.profiles.registerProfileViewListener(this);
  }

  /** Fire and forget: a buffer failure loses the view and never reaches the reader. */
  profileViewed(view: ProfileView): void {
    if (view.viewerId === view.profileUserId) return;
    this.buffer
      .push({
        viewerId: view.viewerId,
        viewedId: view.profileUserId,
        day: dayOf(view.at),
        at: view.at.toISOString(),
      })
      .catch((error: unknown) => this.logger.warn(`Profile view lost: ${String(error)}`));
  }

  async settings(userId: string): Promise<NetworkSettings> {
    return { privateProfileViews: await this.network.privateProfileViews(userId) };
  }

  async updateSettings(userId: string, patch: Partial<NetworkSettings>): Promise<NetworkSettings> {
    if (patch.privateProfileViews !== undefined) {
      await this.network.setPrivateProfileViews(
        userId,
        patch.privateProfileViews,
        this.clock.now(),
      );
    }
    return this.settings(userId);
  }

  async summary(userId: string): Promise<ProfileViewsSummary> {
    const now = this.clock.now();
    const excluded = await this.network.blockedIds(userId);
    const count = (days: number) =>
      this.network.countProfileViews(userId, windowStart(now, days), excluded);
    const [last7Days, last30Days, last90Days] = await Promise.all([count(7), count(30), count(90)]);
    return {
      last7Days,
      last30Days,
      last90Days,
      retentionDays: this.config.network.profileViewsRetentionDays,
    };
  }

  /** Visits newest first; private ones carry the sector the visitor shows, if any. */
  async visits(userId: string, query: CursorPageQuery): Promise<CursorPage<ProfileVisit>> {
    const fields = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.network.profileViews(
      userId,
      windowStart(this.clock.now(), this.config.network.profileViewsRetentionDays),
      {
        after: fields ? { day: fields['day'] ?? '', viewerId: fields['viewer'] ?? '' } : null,
        limit: query.limit + 1,
        excludedUserIds: await this.network.blockedIds(userId),
      },
    );
    const page = rows.slice(0, query.limit);
    const publicIds = page.filter((row) => !row.private).map((row) => row.viewerId);
    const privateIds = page.filter((row) => row.private).map((row) => row.viewerId);
    const [cards, sectors] = await Promise.all([
      this.members.cards(publicIds),
      this.profiles.visibleSectors(privateIds),
    ]);
    const items: ProfileVisit[] = [];
    for (const row of page) {
      if (row.private) {
        items.push({
          day: row.day,
          visitor: null,
          anonymous: { sectorCode: anonymizedSector(sectors.get(row.viewerId)) },
        });
        continue;
      }
      const visitor = cards.get(row.viewerId);
      if (visitor) items.push({ day: row.day, visitor, anonymous: null });
    }
    const last = page.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ day: last.day, viewer: last.viewerId })
          : null,
    };
  }
}
