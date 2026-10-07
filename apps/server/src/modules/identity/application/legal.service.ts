import { Inject, Injectable } from '@nestjs/common';
import {
  type LegalAcceptanceRequest,
  type LegalStatus,
  type LegalVersions as LegalVersionsDto,
  MINIMUM_AGE,
} from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { acceptedDocuments, isLegalUpToDate, type LegalRecord } from '../domain/legal';
import { IdentityUserRepository } from './identity-user.repository';

@Injectable()
export class LegalService {
  constructor(
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
    private readonly users: IdentityUserRepository,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  current(): LegalVersionsDto {
    return { ...this.config.legal, minimumAge: MINIMUM_AGE };
  }

  status(record: LegalRecord): LegalStatus {
    return {
      upToDate: isLegalUpToDate(record, this.config.legal),
      acceptedTermsVersion: record.acceptedTermsVersion,
      acceptedPrivacyVersion: record.acceptedPrivacyVersion,
      adultDeclaredAt: record.adultDeclaredAt?.toISOString() ?? null,
      current: this.current(),
    };
  }

  async accept(userId: string, request: LegalAcceptanceRequest): Promise<LegalStatus> {
    const documents = acceptedDocuments(request, this.config.legal);
    await this.transactions.run(() =>
      this.users.recordLegalAcceptance(
        userId,
        documents.map((row) => ({ id: this.ids.next(), ...row })),
        this.config.legal,
        this.clock.now(),
      ),
    );
    const user = await this.users.findById(userId);
    if (!user) throw new DomainError('IDENTITY_USER_NOT_FOUND', 'User not found');
    return this.status(user);
  }
}
