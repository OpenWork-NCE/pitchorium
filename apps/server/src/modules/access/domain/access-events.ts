import type { AssignableRole } from '@pitchorium/contracts';
import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

export class RoleGranted extends DomainEvent<{ role: AssignableRole; grantedBy: string | null }> {
  static readonly TYPE = 'access.role.granted.v1';
  readonly type = RoleGranted.TYPE;
  readonly aggregateType = 'user';

  constructor(props: DomainEventProps<RoleGranted['payload']>) {
    super(props);
  }
}

export class RoleRevoked extends DomainEvent<{ role: AssignableRole; revokedBy: string }> {
  static readonly TYPE = 'access.role.revoked.v1';
  readonly type = RoleRevoked.TYPE;
  readonly aggregateType = 'user';

  constructor(props: DomainEventProps<RoleRevoked['payload']>) {
    super(props);
  }
}
