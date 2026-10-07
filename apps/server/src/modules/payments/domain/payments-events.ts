import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

type Payload = DomainEvent['payload'];

/** A contribution event has the contribution as aggregate; payloads hold ids, codes, amounts. */
abstract class ContributionEvent<P extends Payload> extends DomainEvent<P> {
  readonly aggregateType = 'contribution';
}

interface ContributionFacts {
  [key: string]: string | null;
  projectId: string;
  contributorId: string;
  organizationId: string | null;
  kind: string;
}

export class ContributionCreated extends ContributionEvent<
  ContributionFacts & { amountMinor: string; currency: string; eurMinor: string }
> {
  static readonly TYPE = 'payments.contribution.created.v1';
  readonly type = ContributionCreated.TYPE;
  constructor(props: DomainEventProps<ContributionCreated['payload']>) {
    super(props);
  }
}

export class ContributionSucceeded extends ContributionEvent<
  ContributionFacts & { eurMinor: string }
> {
  static readonly TYPE = 'payments.contribution.succeeded.v1';
  readonly type = ContributionSucceeded.TYPE;
  constructor(props: DomainEventProps<ContributionSucceeded['payload']>) {
    super(props);
  }
}

export class ContributionFailed extends ContributionEvent<{ projectId: string; reason: string }> {
  static readonly TYPE = 'payments.contribution.failed.v1';
  readonly type = ContributionFailed.TYPE;
  constructor(props: DomainEventProps<ContributionFailed['payload']>) {
    super(props);
  }
}

export class ContributionExpired extends ContributionEvent<{ projectId: string }> {
  static readonly TYPE = 'payments.contribution.expired.v1';
  readonly type = ContributionExpired.TYPE;
  constructor(props: DomainEventProps<ContributionExpired['payload']>) {
    super(props);
  }
}

/** Canceled by the contributor before paying. */
export class ContributionCanceled extends ContributionEvent<{ projectId: string }> {
  static readonly TYPE = 'payments.contribution.canceled.v1';
  readonly type = ContributionCanceled.TYPE;
  constructor(props: DomainEventProps<ContributionCanceled['payload']>) {
    super(props);
  }
}

export class ContributionRefunded extends ContributionEvent<{
  projectId: string;
  refundId: string;
  amountMinor: string;
  currency: string;
  eurMinor: string;
  full: boolean;
}> {
  static readonly TYPE = 'payments.contribution.refunded.v1';
  readonly type = ContributionRefunded.TYPE;
  constructor(props: DomainEventProps<ContributionRefunded['payload']>) {
    super(props);
  }
}

export class ContributionDisputed extends ContributionEvent<{
  projectId: string;
  disputeId: string;
  amountMinor: string;
  currency: string;
}> {
  static readonly TYPE = 'payments.contribution.disputed.v1';
  readonly type = ContributionDisputed.TYPE;
  constructor(props: DomainEventProps<ContributionDisputed['payload']>) {
    super(props);
  }
}

export class ContributionDisputeResolved extends ContributionEvent<{
  projectId: string;
  disputeId: string;
  outcome: 'won' | 'lost';
  eurMinor: string;
}> {
  static readonly TYPE = 'payments.contribution.dispute-resolved.v1';
  readonly type = ContributionDisputeResolved.TYPE;
  constructor(props: DomainEventProps<ContributionDisputeResolved['payload']>) {
    super(props);
  }
}

abstract class OfflineContributionEvent<P extends Payload> extends DomainEvent<P> {
  readonly aggregateType = 'offline_contribution';
}

type OfflinePayload = { projectId: string; kind: string; by: string };

export class OfflineContributionDeclared extends OfflineContributionEvent<
  OfflinePayload & { declaredBy: string }
> {
  static readonly TYPE = 'payments.offline-contribution.declared.v1';
  readonly type = OfflineContributionDeclared.TYPE;
  constructor(props: DomainEventProps<OfflineContributionDeclared['payload']>) {
    super(props);
  }
}

export class OfflineContributionConfirmed extends OfflineContributionEvent<OfflinePayload> {
  static readonly TYPE = 'payments.offline-contribution.confirmed.v1';
  readonly type = OfflineContributionConfirmed.TYPE;
  constructor(props: DomainEventProps<OfflineContributionConfirmed['payload']>) {
    super(props);
  }
}

export class OfflineContributionValidated extends OfflineContributionEvent<
  OfflinePayload & { eurMinor: string }
> {
  static readonly TYPE = 'payments.offline-contribution.validated.v1';
  readonly type = OfflineContributionValidated.TYPE;
  constructor(props: DomainEventProps<OfflineContributionValidated['payload']>) {
    super(props);
  }
}

export class OfflineContributionRejected extends OfflineContributionEvent<OfflinePayload> {
  static readonly TYPE = 'payments.offline-contribution.rejected.v1';
  readonly type = OfflineContributionRejected.TYPE;
  constructor(props: DomainEventProps<OfflineContributionRejected['payload']>) {
    super(props);
  }
}

/** The payout account has the holder as aggregate. */
abstract class PayoutAccountEvent<P extends Payload> extends DomainEvent<P> {
  readonly aggregateType = 'payout_account';
}

export class PayoutAccountOnboarded extends PayoutAccountEvent<{
  provider: string;
  country: string;
}> {
  static readonly TYPE = 'payments.payout-account.onboarded.v1';
  readonly type = PayoutAccountOnboarded.TYPE;
  constructor(props: DomainEventProps<PayoutAccountOnboarded['payload']>) {
    super(props);
  }
}

export class PayoutAccountUpdated extends PayoutAccountEvent<{
  status: string;
  fields: string[];
}> {
  static readonly TYPE = 'payments.payout-account.updated.v1';
  readonly type = PayoutAccountUpdated.TYPE;
  constructor(props: DomainEventProps<PayoutAccountUpdated['payload']>) {
    super(props);
  }
}

/** KYC events have the holder as aggregate. */
abstract class KycEvent<P extends Payload> extends DomainEvent<P> {
  readonly aggregateType = 'kyc';
}

export class KycSubmitted extends KycEvent<{ submissionId: string }> {
  static readonly TYPE = 'payments.kyc.submitted.v1';
  readonly type = KycSubmitted.TYPE;
  constructor(props: DomainEventProps<KycSubmitted['payload']>) {
    super(props);
  }
}

/** `submissionId` is null when the provider verified the holder. */
export class KycApproved extends KycEvent<{ submissionId: string | null; mode: string }> {
  static readonly TYPE = 'payments.kyc.approved.v1';
  readonly type = KycApproved.TYPE;
  constructor(props: DomainEventProps<KycApproved['payload']>) {
    super(props);
  }
}

export class KycRejected extends KycEvent<{ submissionId: string; decidedBy: string }> {
  static readonly TYPE = 'payments.kyc.rejected.v1';
  readonly type = KycRejected.TYPE;
  constructor(props: DomainEventProps<KycRejected['payload']>) {
    super(props);
  }
}

export class DiscrepancyDetected extends DomainEvent<{
  kind: string;
  reference: string;
  provider: string | null;
}> {
  static readonly TYPE = 'payments.reconciliation.discrepancy-detected.v1';
  readonly type = DiscrepancyDetected.TYPE;
  readonly aggregateType = 'discrepancy';
  constructor(props: DomainEventProps<DiscrepancyDetected['payload']>) {
    super(props);
  }
}

/** Internal: a verified notification of a provider, processed by the worker. */
export class ProviderEventReceived extends DomainEvent<{
  provider: string;
  type: string;
  contributionId: string | null;
  /** Payment at the provider, to verify through its API (Flutterwave transaction). */
  providerPaymentId: string | null;
  providerAccountId: string | null;
  /** Payment named only by its provider reference (Flutterwave chargeback `flw_ref`). */
  paymentReference: string | null;
}> {
  static readonly TYPE = 'payments.provider-event.received.v1';
  readonly type = ProviderEventReceived.TYPE;
  readonly aggregateType = 'provider_event';
  constructor(props: DomainEventProps<ProviderEventReceived['payload']>) {
    super(props);
  }
}
