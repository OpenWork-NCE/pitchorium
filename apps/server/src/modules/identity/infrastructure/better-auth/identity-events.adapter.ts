import { DEFAULT_LOCALE, localeSchema } from '@pitchorium/contracts';
import type { DBAdapter, DBAdapterInstance, Where } from 'better-auth/types';
import type { TransactionManager } from '../../../../platform/database';
import type { IdentityEventsRecorder } from '../../application/identity-events.recorder';
import type {
  PasswordChangeReason,
  RegistrationMethod,
  SessionRevocationReason,
  SessionRevocationScope,
} from '../../domain/identity-events';
import type { AuthRequestScope } from './auth-request-scope';

export interface IdentityEventsAdapterDependencies {
  transactions: TransactionManager;
  scope: AuthRequestScope;
  events: IdentityEventsRecorder;
}

type Row = Record<string, unknown>;
type WriteAdapter = Omit<DBAdapter, 'transaction'> & Partial<Pick<DBAdapter, 'transaction'>>;

/** Auth paths (relative to /v1/auth) whose session deletions are a revocation. */
const REVOCATIONS: Readonly<
  Record<string, { scope: SessionRevocationScope; reason: SessionRevocationReason }>
> = {
  '/revoke-session': { scope: 'one', reason: 'user_request' },
  '/revoke-other-sessions': { scope: 'others', reason: 'user_request' },
  '/revoke-sessions': { scope: 'all', reason: 'user_request' },
  // With revokeOtherSessions, Better Auth deletes every session and opens a new one.
  '/change-password': { scope: 'others', reason: 'user_request' },
  '/reset-password': { scope: 'all', reason: 'password_reset' },
};

const PASSWORD_CHANGES: Readonly<Record<string, PasswordChangeReason>> = {
  '/change-password': 'changed',
  '/reset-password': 'reset',
};

function registrationMethod(path: string | undefined): RegistrationMethod {
  const provider = /^\/callback\/([a-z]+)$/.exec(path ?? '')?.[1];
  if (provider === 'google' || provider === 'linkedin' || provider === 'microsoft') return provider;
  if (path === '/magic-link/verify') return 'magic_link';
  return 'credential';
}

const text = (row: Row | null | undefined, field: string): string | undefined => {
  const value = row?.[field];
  return typeof value === 'string' ? value : undefined;
};

/** Value of an equality condition on `field`, used to find the user of a bulk write. */
function whereValue(where: Where[], field: string): string | undefined {
  const condition = where.find(
    (candidate) => candidate.field === field && (candidate.operator ?? 'eq') === 'eq',
  );
  return typeof condition?.value === 'string' ? condition.value : undefined;
}

/**
 * Wraps the Better Auth adapter so that every write and the identity event it produces commit in
 * one short transaction (ADR 0019). Better Auth database hooks cannot do it: their `after` part
 * runs once Better Auth's own transaction has committed. Reads are not wrapped, and no
 * transaction spans a network call (OAuth exchange, Have I Been Pwned).
 */
export function withIdentityEvents(
  instance: DBAdapterInstance,
  deps: IdentityEventsAdapterDependencies,
): DBAdapterInstance {
  return (options) => wrap(instance(options), deps) as DBAdapter;
}

function wrap(adapter: WriteAdapter, deps: IdentityEventsAdapterDependencies): WriteAdapter {
  const { transactions, scope, events } = deps;

  /** Records an event once per auth request, for writes that Better Auth may repeat. */
  const once = async (key: string, record: () => Promise<void>): Promise<void> => {
    const state = scope.current();
    if (state?.emitted.has(key)) return;
    state?.emitted.add(key);
    await record();
  };

  const afterCreate = async (model: string, row: Row): Promise<void> => {
    const state = scope.current();
    const userId = model === 'user' ? text(row, 'id') : text(row, 'userId');
    if (!userId) return;
    if (model === 'user') {
      state?.registeredUserIds.add(userId);
      const locale = localeSchema.safeParse(row['locale']);
      const emailVerified = row['emailVerified'] === true;
      await events.userRegistered(userId, {
        method: registrationMethod(state?.path),
        locale: locale.success ? locale.data : DEFAULT_LOCALE,
        emailVerified,
      });
      if (emailVerified) await events.emailVerified(userId);
    } else if (model === 'account' && !state?.registeredUserIds.has(userId)) {
      await events.accountLinked(userId, text(row, 'providerId') ?? 'unknown');
    }
  };

  const afterUpdate = async (
    model: string,
    update: Row,
    userId: string | undefined,
  ): Promise<void> => {
    if (!userId) return;
    // Better Auth only writes emailVerified=true on an unverified user.
    if (model === 'user' && update['emailVerified'] === true) {
      await once(`email-verified:${userId}`, () => events.emailVerified(userId));
    }
    const reason = PASSWORD_CHANGES[scope.current()?.path ?? ''];
    if (model === 'account' && update['password'] !== undefined && reason) {
      await once(`password:${userId}`, () => events.passwordChanged(userId, reason));
    }
  };

  /** Rows about to be deleted, loaded only for the models that produce events. */
  const doomed = async (model: string, where: Where[]): Promise<Row[]> =>
    model === 'account' || model === 'session' ? adapter.findMany<Row>({ model, where }) : [];

  const afterDelete = async (model: string, rows: Row[]): Promise<void> => {
    if (model === 'account') {
      for (const row of rows) {
        const userId = text(row, 'userId');
        if (userId) await events.accountUnlinked(userId, text(row, 'providerId') ?? 'unknown');
      }
      return;
    }
    const revocation = REVOCATIONS[scope.current()?.path ?? ''];
    const userId = text(rows[0], 'userId');
    if (model === 'session' && revocation && userId) {
      await once(`sessions:${userId}`, () =>
        events.sessionsRevoked(userId, revocation.scope, revocation.reason),
      );
    }
  };

  const wrapped: WriteAdapter = {
    ...adapter,
    create: (data) =>
      transactions.run(async () => {
        const created = await adapter.create<Row>(data);
        await afterCreate(data.model, created);
        return created as never;
      }),
    update: (data) =>
      transactions.run(async () => {
        const updated = await adapter.update<Row>(data);
        const userId = data.model === 'user' ? text(updated, 'id') : text(updated, 'userId');
        if (updated) await afterUpdate(data.model, data.update, userId);
        return updated as never;
      }),
    updateMany: (data) =>
      transactions.run(async () => {
        const count = await adapter.updateMany(data);
        const userId = whereValue(data.where, data.model === 'user' ? 'id' : 'userId');
        if (count > 0) await afterUpdate(data.model, data.update, userId);
        return count;
      }),
    delete: (data) =>
      transactions.run(async () => {
        const rows = await doomed(data.model, data.where);
        await adapter.delete(data);
        await afterDelete(data.model, rows);
      }),
    deleteMany: (data) =>
      transactions.run(async () => {
        const rows = await doomed(data.model, data.where);
        const count = await adapter.deleteMany(data);
        await afterDelete(data.model, rows);
        return count;
      }),
  };
  if (adapter.transaction) {
    const transaction = adapter.transaction.bind(adapter);
    wrapped.transaction = (callback) =>
      transaction((trx) => callback(wrap(trx, deps) as Parameters<typeof callback>[0]));
  }
  return wrapped;
}
