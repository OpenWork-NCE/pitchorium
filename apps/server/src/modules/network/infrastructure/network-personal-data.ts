import { Injectable, type OnModuleInit } from '@nestjs/common';
import { and, eq, or } from '@pitchorium/db/orm';
import {
  networkBlocks,
  networkConnectionRequests,
  networkConnections,
  networkFollows,
  networkProfileViews,
  networkSettings,
} from '@pitchorium/db/schemas/network';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

const MEMBER = 'member';

/**
 * Personal data of network: follows, connections, requests, blocks, settings and the views
 * of the profile (private visits stay anonymous). The erasure removes every relation of the
 * member, in both directions.
 */
@Injectable()
export class NetworkPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'network',
      description:
        'Who and what you follow, your connections, the connection requests you sent and received, the members you blocked, your settings and the views of your profile (private visits stay anonymous).',
      order: ERASURE_ORDER.activity,
      exporter: { export: (userId) => this.export(userId) },
      eraser: {
        erase: async ({ userId }) => {
          await this.db
            .delete(networkFollows)
            .where(
              or(
                eq(networkFollows.followerId, userId),
                and(eq(networkFollows.targetType, MEMBER), eq(networkFollows.targetId, userId)),
              ),
            );
          await this.db
            .delete(networkConnections)
            .where(
              or(eq(networkConnections.userId, userId), eq(networkConnections.peerId, userId)),
            );
          await this.db
            .delete(networkConnectionRequests)
            .where(
              or(
                eq(networkConnectionRequests.requesterId, userId),
                eq(networkConnectionRequests.addresseeId, userId),
              ),
            );
          await this.db
            .delete(networkBlocks)
            .where(or(eq(networkBlocks.blockerId, userId), eq(networkBlocks.blockedId, userId)));
          await this.db.delete(networkSettings).where(eq(networkSettings.userId, userId));
          await this.db
            .delete(networkProfileViews)
            .where(
              or(
                eq(networkProfileViews.viewedId, userId),
                eq(networkProfileViews.viewerId, userId),
              ),
            );
        },
      },
    });
  }

  private async export(userId: string) {
    const views = await this.db
      .select()
      .from(networkProfileViews)
      .where(eq(networkProfileViews.viewedId, userId));
    return {
      data: {
        following: await this.db
          .select()
          .from(networkFollows)
          .where(eq(networkFollows.followerId, userId)),
        connections: await this.db
          .select()
          .from(networkConnections)
          .where(eq(networkConnections.userId, userId)),
        connectionRequests: await this.db
          .select()
          .from(networkConnectionRequests)
          .where(
            or(
              eq(networkConnectionRequests.requesterId, userId),
              eq(networkConnectionRequests.addresseeId, userId),
            ),
          ),
        blocked: await this.db
          .select()
          .from(networkBlocks)
          .where(eq(networkBlocks.blockerId, userId)),
        settings: await this.db
          .select()
          .from(networkSettings)
          .where(eq(networkSettings.userId, userId)),
        profileViews: views.map((view) => ({
          day: view.day,
          viewerId: view.private ? null : view.viewerId,
          private: view.private,
        })),
        profileViewsMade: await this.db
          .select({ viewedId: networkProfileViews.viewedId, day: networkProfileViews.day })
          .from(networkProfileViews)
          .where(eq(networkProfileViews.viewerId, userId)),
      },
    };
  }
}
