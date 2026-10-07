import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type CommonConfig, COMMON_CONFIG } from '../config';
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
    {
      provide: Mailer,
      inject: [COMMON_CONFIG],
      useFactory: (config: CommonConfig) => createMailer(config.mail),
    },
  ],
  exports: [Mailer],
})
export class MailerModule implements OnApplicationShutdown {
  constructor(private readonly mailer: Mailer) {}

  onApplicationShutdown(): void {
    if (this.mailer instanceof SmtpMailer) {
      this.mailer.close();
    }
  }
}
