import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { AccountLinked, IdentityModule, UserRegistered } from '../../src/modules/identity';
import { MediaModule } from '../../src/modules/media';
import { ProfilesModule } from '../../src/modules/profiles';
import { AuditModule } from '../../src/platform/audit';
import { FeatureFlagsModule } from '../../src/platform/feature-flags';
import { IdGenerator } from '../../src/platform/kernel';
import { MailerModule } from '../../src/platform/mailer';
import { DomainEventDispatcher, type OutboxEnvelope } from '../../src/platform/outbox';
import { StorageModule } from '../../src/platform/storage';
import { query, truncateAllTables } from './support/database';
import { Mailpit } from './support/mailpit';
import { createWorkerTestingModule } from './support/worker-testing-module';

describe('worker handlers', () => {
  let moduleRef: TestingModule;
  let dispatcher: DomainEventDispatcher;
  let ids: IdGenerator;
  const mailpit = new Mailpit();

  beforeAll(async () => {
    moduleRef = await createWorkerTestingModule(
      [],
      [
        FeatureFlagsModule,
        AuditModule,
        MailerModule,
        StorageModule,
        IdentityModule.forWorker(),
        AccessModule.forWorker(),
        MediaModule.forWorker(),
        ProfilesModule.forWorker(),
      ],
    );
    dispatcher = moduleRef.get(DomainEventDispatcher);
    ids = moduleRef.get(IdGenerator);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    await mailpit.clear();
  });

  async function insertUser(email: string, name: string): Promise<string> {
    const id = ids.next();
    await query(
      `INSERT INTO identity.users (id, name, email, email_verified, image, locale, created_at, updated_at)
       VALUES ($1, $2, $3, true, 'https://photos.example/a.jpg', 'en', now(), now())`,
      [id, name, email],
    );
    return id;
  }

  function envelope(
    type: string,
    userId: string,
    payload: OutboxEnvelope['payload'],
  ): OutboxEnvelope {
    return {
      id: ids.next(),
      type,
      aggregateType: 'user',
      aggregateId: userId,
      occurredAt: new Date().toISOString(),
      payload,
    };
  }

  it('creates the base profile once per registration, even when the event is replayed', async () => {
    const userId = await insertUser('new@example.com', 'Kwame Mensah');
    const registered = envelope(UserRegistered.TYPE, userId, {
      method: 'google',
      locale: 'en',
      emailVerified: true,
    });

    await dispatcher.dispatch(registered);
    await dispatcher.dispatch(registered);
    // Replay after the inbox entry is lost: the creation itself is idempotent.
    await query('DELETE FROM platform.inbox_messages');
    await dispatcher.dispatch(registered);

    const profiles = await query<{ handle: string; display_name: string; avatar_url: string }>(
      'SELECT handle, display_name, avatar_url FROM profiles.profiles WHERE user_id = $1',
      [userId],
    );
    expect(profiles).toEqual([
      {
        handle: 'kwame-mensah',
        display_name: 'Kwame Mensah',
        avatar_url: 'https://photos.example/a.jpg',
      },
    ]);
    const created = await query(
      `SELECT payload FROM platform.outbox_events WHERE event_type = 'profiles.profile.created.v1'`,
    );
    expect(created).toEqual([{ payload: { handle: 'kwame-mensah' } }]);
  });

  it('emails the member when a sign-in method is added', async () => {
    const userId = await insertUser('linked@example.com', 'Linked Member');

    await dispatcher.dispatch(envelope(AccountLinked.TYPE, userId, { provider: 'linkedin' }));

    const email = await mailpit.waitFor('linked@example.com', 'Your sign-in methods changed');
    expect(email.text).toContain('LinkedIn was added to your sign-in methods');
  });
});
