import type { Intention, ProfileVisibility } from '@pitchorium/contracts';
import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

export type FacetChange = 'created' | 'updated' | 'deleted';

abstract class ProfileEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'profile';
}

export class ProfileCreated extends ProfileEvent<{ handle: string }> {
  static readonly TYPE = 'profiles.profile.created.v1';
  readonly type = ProfileCreated.TYPE;

  constructor(props: DomainEventProps<ProfileCreated['payload']>) {
    super(props);
  }
}

/** Lists the changed field names, never their values. */
export class ProfileUpdated extends ProfileEvent<{ fields: string[] }> {
  static readonly TYPE = 'profiles.profile.updated.v1';
  readonly type = ProfileUpdated.TYPE;

  constructor(props: DomainEventProps<ProfileUpdated['payload']>) {
    super(props);
  }
}

export class IntentionSet extends ProfileEvent<{ intention: Intention | null }> {
  static readonly TYPE = 'profiles.profile.intention-set.v1';
  readonly type = IntentionSet.TYPE;

  constructor(props: DomainEventProps<IntentionSet['payload']>) {
    super(props);
  }
}

export class EntrepreneurFacetUpdated extends ProfileEvent<{ change: FacetChange }> {
  static readonly TYPE = 'profiles.profile.entrepreneur-facet-updated.v1';
  readonly type = EntrepreneurFacetUpdated.TYPE;

  constructor(props: DomainEventProps<EntrepreneurFacetUpdated['payload']>) {
    super(props);
  }
}

export class ContributorFacetUpdated extends ProfileEvent<{ change: FacetChange }> {
  static readonly TYPE = 'profiles.profile.contributor-facet-updated.v1';
  readonly type = ContributorFacetUpdated.TYPE;

  constructor(props: DomainEventProps<ContributorFacetUpdated['payload']>) {
    super(props);
  }
}

export class HandleChanged extends ProfileEvent<{ previous: string; current: string }> {
  static readonly TYPE = 'profiles.profile.handle-changed.v1';
  readonly type = HandleChanged.TYPE;

  constructor(props: DomainEventProps<HandleChanged['payload']>) {
    super(props);
  }
}

export class VisibilityChanged extends ProfileEvent<ProfileVisibility> {
  static readonly TYPE = 'profiles.profile.visibility-changed.v1';
  readonly type = VisibilityChanged.TYPE;

  constructor(props: DomainEventProps<VisibilityChanged['payload']>) {
    super(props);
  }
}
