/** Public facade of the identity module: the only file other modules may import. */
export type { IdentityUser } from './application/identity-user.repository';
export { IdentityFacade } from './application/identity.facade';
export {
  type AuthenticatedSession,
  SessionAuthenticator,
} from './application/session-authenticator';
export {
  AccountDeletionRequested,
  AccountLinked,
  AccountUnlinked,
  EmailVerified,
  PasswordChanged,
  SessionsRevoked,
  UserRegistered,
} from './domain/identity-events';
export { IdentityModule } from './identity.module';
