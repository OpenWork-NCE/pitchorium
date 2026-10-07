/** Public facade of the network module: the only file other modules may import. */
export { NetworkFacade } from './application/network.facade';
export type { FollowTargetSummary, FollowTargetType } from './application/ports';
export {
  BlockCreated,
  BlockRemoved,
  ConnectionAccepted,
  ConnectionDeclined,
  ConnectionRemoved,
  ConnectionRequested,
  ConnectionWithdrawn,
  FollowCreated,
  FollowRemoved,
} from './domain/network-events';
export { NetworkModule } from './network.module';
