/**
 * Apollo 30K - Configuration Index
 *
 * Central export for all configuration modules
 *
 * @package @blackroad/apollo-30k-deployment
 * @author BlackRoad OS, Inc.
 * @license Proprietary
 */

// Integration configurations
export * from './integrations';

// State management
export * from './state-manager';

// Re-export commonly used items
export { INTEGRATIONS, IntegrationManager, integrationManager, ENDPOINTS } from './integrations';
export { StateManager, stateManager } from './state-manager';

// Configuration types
export type { Integration, IntegrationStatus, IntegrationType } from './integrations';
export type { StateItem, KanbanState, StateSource, SyncStatus } from './state-manager';
