/** Public facade of the privacy module: the only file other modules may import. */
export {
  type AccountContact,
  type AccountDirectory,
  ERASURE_ORDER,
  type ErasureBlocker,
  type ErasureContext,
  type ExportedFile,
  type PersonalDataEraser,
  type PersonalDataExport,
  type PersonalDataExporter,
  type PersonalDataRegistration,
} from './application/personal-data';
export { ErasureExecutorService } from './application/erasure-executor.service';
export { PrivacyFacade } from './application/privacy.facade';
export {
  ErasureCanceled,
  ErasureExecuted,
  ErasureReminderDue,
  ErasureRequested,
  ExportReady,
  ExportRequested,
} from './domain/privacy-events';
export { PrivacyModule } from './privacy.module';
