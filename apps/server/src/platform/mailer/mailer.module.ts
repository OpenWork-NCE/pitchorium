import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type CommonConfig, COMMON_CONFIG } from '../config';
import { MailSuppressionRegistry, SuppressingMailer } from './mail-suppressions';
import { Mailer } from './mailer';
import { ResendMailer } from './resend-mailer';
import { SmtpMailer } from './smtp-mailer';

export function createMailer(config: CommonConfig['mail']): Mailer {
  switch (config.transport) {
    case 'smtp':
      return new SmtpMailer(config.smtpUrl, config.from);
    case 'resend':
      return new ResendMailer(config.resendApiKey, config.from);
  }
}

@Global()
@Module({
  providers: [
    MailSuppressionRegistry,
    {
      provide: Mailer,
      inject: [COMMON_CONFIG, MailSuppressionRegistry],
      useFactory: (config: CommonConfig, suppressions: MailSuppressionRegistry) =>
        new SuppressingMailer(createMailer(config.mail), suppressions),
    },
  ],
  exports: [Mailer, MailSuppressionRegistry],
})
export class MailerModule implements OnApplicationShutdown {
  constructor(private readonly mailer: Mailer) {}

  onApplicationShutdown(): void {
    const transport =
      this.mailer instanceof SuppressingMailer ? this.mailer.transport : this.mailer;
    if (transport instanceof SmtpMailer) {
      transport.close();
    }
  }
}
