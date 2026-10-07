/** Public facade of the access module: the only file other modules may import. */
export { AccessFacade } from './application/access.facade';
export {
  AdminBootstrapService,
  type AdminBootstrapResult,
} from './application/admin-bootstrap.service';
export type { PrerequisiteProvider } from './application/ports';
export { RoleGranted, RoleRevoked } from './domain/access-events';
export type { Actor } from './domain/actor';
export { AccessModule } from './access.module';
export { CurrentActor } from './interface/current-actor.decorator';
