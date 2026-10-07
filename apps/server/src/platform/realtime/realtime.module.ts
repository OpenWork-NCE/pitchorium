import { Global, Module } from '@nestjs/common';
import { AllowAnonymousHandshakeGuard, RealtimeHandshakeGuard } from './handshake-guard';
import { MembersGateway } from './members.gateway';
import { RealtimePublisher, RedisRealtimePublisher } from './realtime-publisher';
import { SystemGateway } from './system.gateway';

/** Pushes to connected members, from the api and the worker. */
@Global()
@Module({
  providers: [{ provide: RealtimePublisher, useClass: RedisRealtimePublisher }],
  exports: [RealtimePublisher],
})
export class RealtimePublisherModule {}

/** Socket.IO gateways of the api. */
@Module({
  providers: [
    SystemGateway,
    MembersGateway,
    { provide: RealtimeHandshakeGuard, useClass: AllowAnonymousHandshakeGuard },
  ],
  exports: [RealtimeHandshakeGuard],
})
export class RealtimeModule {}
