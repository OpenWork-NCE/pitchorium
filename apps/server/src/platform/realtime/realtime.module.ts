import { Module } from '@nestjs/common';
import { AllowAnonymousHandshakeGuard, RealtimeHandshakeGuard } from './handshake-guard';
import { SystemGateway } from './system.gateway';

@Module({
  providers: [
    SystemGateway,
    { provide: RealtimeHandshakeGuard, useClass: AllowAnonymousHandshakeGuard },
  ],
  exports: [RealtimeHandshakeGuard],
})
export class RealtimeModule {}
