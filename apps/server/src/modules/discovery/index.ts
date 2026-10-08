/** Public facade of the discovery module: the only file other modules may import. */
export { DiscoveryFacade } from './application/discovery.facade';
export { type DriftReport, IndexMaintenanceService } from './application/index-maintenance.service';
export { IndexDriftDetected, SuggestionDismissed } from './domain/discovery-events';
export { DiscoveryModule } from './discovery.module';
