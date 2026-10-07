import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AccessModule, AdminBootstrapService } from './modules/access';
import { IdentityModule } from './modules/identity';
import { AuditModule } from './platform/audit';
import { ConfigModule, loadConfigOrExit, parseWorkerConfig } from './platform/config';
import { CoreModule } from './platform/core/core.module';
import { DatabaseModule } from './platform/database';
import { FeatureFlagsModule } from './platform/feature-flags';
import { MailerModule } from './platform/mailer';
import { OutboxModule } from './platform/outbox';

/** Only what granting a role needs: no queue, no relay, no HTTP. */
@Module({
  imports: [
    ConfigModule.forWorker(),
    CoreModule,
    DatabaseModule,
    OutboxModule,
    AuditModule,
    FeatureFlagsModule,
    MailerModule,
    IdentityModule.forWorker(),
    AccessModule.forWorker(),
  ],
})
class CreateAdminModule {}

function emailArgument(): string {
  const index = process.argv.indexOf('--email');
  const email = index >= 0 ? process.argv[index + 1] : undefined;
  if (!email) {
    process.stderr.write('Usage: pnpm admin:create --email <email of an existing account>\n');
    process.exit(2);
  }
  return email;
}

/** Grants the admin role to an existing account. Idempotent; never exposed through the api. */
async function run(): Promise<void> {
  const email = emailArgument();
  loadConfigOrExit(parseWorkerConfig);
  const app = await NestFactory.createApplicationContext(CreateAdminModule, { logger: ['error'] });
  try {
    const result = await app.get(AdminBootstrapService).ensureAdmin(email);
    process.stdout.write(
      result === 'granted'
        ? 'Admin role granted. The account must sign in again and enable two-factor authentication.\n'
        : 'The account is already an admin: nothing changed.\n',
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
