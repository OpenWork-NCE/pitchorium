import { Injectable } from '@nestjs/common';
import { asc } from '@pitchorium/db/orm';
import {
  profilesCountries,
  profilesSectors,
  profilesStages,
} from '@pitchorium/db/schemas/profiles';
import { TransactionManager } from '../../../platform/database';
import { type ReferenceData, ReferenceDataRepository } from '../application/ports';

@Injectable()
export class DrizzleReferenceDataRepository extends ReferenceDataRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  async load(): Promise<ReferenceData> {
    const db = this.transactions.executor;
    const [countries, sectors, stages] = await Promise.all([
      db.select().from(profilesCountries).orderBy(asc(profilesCountries.code)),
      db.select().from(profilesSectors).orderBy(asc(profilesSectors.position)),
      db.select().from(profilesStages).orderBy(asc(profilesStages.position)),
    ]);
    return { countries, sectors, stages };
  }
}
