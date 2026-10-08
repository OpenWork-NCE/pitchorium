import { Injectable, type OnModuleInit } from '@nestjs/common';
import { and, eq, inArray, or, sql } from '@pitchorium/db/orm';
import { missionsEngagements, missionsMissions } from '@pitchorium/db/schemas/missions';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';
import { MissionEventsRecorder } from '../application/mission-events.recorder';
import { MissionClosed } from '../domain/mission-events';

const OPEN = ['requested', 'accepted'];

/**
 * Personal data of missions: missions published and engagements as expert or beneficiary.
 * The erasure closes the open missions of the member, cancels their engagements in progress
 * and keeps the history under the pseudonym (the hours stay with the other party).
 */
@Injectable()
export class MissionsPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly recorder: MissionEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'missions',
      description:
        'The volunteer missions you published and your engagements as expert or beneficiary, with their messages.',
      order: ERASURE_ORDER.contents,
      exporter: {
        export: async (userId) => ({
          data: {
            missions: await this.db
              .select()
              .from(missionsMissions)
              .where(eq(missionsMissions.authorId, userId)),
            engagements: await this.db
              .select()
              .from(missionsEngagements)
              .where(
                or(
                  eq(missionsEngagements.expertId, userId),
                  eq(missionsEngagements.beneficiaryId, userId),
                ),
              ),
          },
        }),
      },
      eraser: { erase: ({ userId, pseudonym }) => this.erase(userId, pseudonym) },
    });
  }

  private async erase(userId: string, pseudonym: string): Promise<void> {
    const db = this.db;
    const now = this.clock.now();
    const touched = await db
      .update(missionsEngagements)
      .set({ status: 'canceled', endedAt: now, updatedAt: now })
      .where(
        and(
          inArray(missionsEngagements.status, OPEN),
          or(
            eq(missionsEngagements.expertId, userId),
            eq(missionsEngagements.beneficiaryId, userId),
          ),
        ),
      )
      .returning({ missionId: missionsEngagements.missionId });
    const open = await db
      .update(missionsMissions)
      .set({ status: 'closed', closedAt: now, updatedAt: now })
      .where(and(eq(missionsMissions.authorId, userId), eq(missionsMissions.status, 'open')))
      .returning({ id: missionsMissions.id });
    for (const mission of open)
      await this.recorder.record(MissionClosed, mission.id, { by: pseudonym });
    const missionIds = [...new Set(touched.map((row) => row.missionId))];
    if (missionIds.length > 0) {
      await db.execute(sql`
        update missions.missions m set active_engagements = (
          select count(*) from missions.engagements e
          where e.mission_id = m.id and e.status = 'accepted')
        where m.id = any(${missionIds}::uuid[])`);
    }
    await replaceIdentifier(
      db,
      [
        { table: 'missions.missions', column: 'author_id' },
        { table: 'missions.engagements', column: 'expert_id' },
        { table: 'missions.engagements', column: 'beneficiary_id' },
      ],
      userId,
      pseudonym,
    );
  }
}
