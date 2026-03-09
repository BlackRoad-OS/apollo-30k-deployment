/**
 * Apollo 30K - Utilities Index
 *
 * Central export for all utility modules
 *
 * @package @blackroad/apollo-30k-deployment
 * @author BlackRoad OS, Inc.
 * @license Proprietary
 */

// Hashing utilities
export * from './hashing';

// Re-export commonly used items
export {
  sha256,
  hash,
  hashWithMetadata,
  verify,
  shaInfinity,
  verifySHAInfinityChain,
  hashAgentState,
  hashGitHubItem,
  hashConfig,
  hashJob,
  hashDeployment,
  hashStateForSync,
  createAuditHash,
  hashKanbanCard,
  hashKanbanBoard,
  generateHashId,
  combineHashes,
  truncateHash,
  formatHash,
} from './hashing';

// Types
export type { HashAlgorithm, HashResult, ChainedHash, SHAInfinityConfig } from './hashing';
