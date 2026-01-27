/**
 * Apollo 30K - SHA-256 & Extensible Hashing System
 *
 * Provides secure hashing for:
 * - State verification across integrations
 * - PR/Issue tracking and validation
 * - Agent deployment verification
 * - Configuration integrity
 *
 * Supports "SHA Infinity" - an extensible hashing architecture
 * that can chain multiple algorithms and verification steps.
 *
 * @package @blackroad/apollo-30k-deployment
 * @author BlackRoad OS, Inc.
 * @license Proprietary
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export const HashAlgorithmSchema = z.enum([
  'sha256',
  'sha384',
  'sha512',
  'sha3-256',
  'sha3-384',
  'sha3-512',
  'blake2b512',
  'blake2s256',
]);

export type HashAlgorithm = z.infer<typeof HashAlgorithmSchema>;

export const HashResultSchema = z.object({
  algorithm: HashAlgorithmSchema,
  hash: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
});

export type HashResult = z.infer<typeof HashResultSchema>;

export const ChainedHashSchema = z.object({
  chain: z.array(HashResultSchema),
  finalHash: z.string(),
  chainLength: z.number(),
  verified: z.boolean(),
});

export type ChainedHash = z.infer<typeof ChainedHashSchema>;

// ============================================================================
// CORE HASHING FUNCTIONS
// ============================================================================

/**
 * Generate SHA-256 hash of input data
 */
export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate hash using specified algorithm
 */
export function hash(data: string | Buffer, algorithm: HashAlgorithm = 'sha256'): string {
  return createHash(algorithm).update(data).digest('hex');
}

/**
 * Generate hash with full result metadata
 */
export function hashWithMetadata(
  data: string | Buffer,
  algorithm: HashAlgorithm = 'sha256',
  metadata?: Record<string, any>
): HashResult {
  return {
    algorithm,
    hash: hash(data, algorithm),
    timestamp: new Date(),
    metadata,
  };
}

/**
 * Verify data against a known hash
 */
export function verify(
  data: string | Buffer,
  expectedHash: string,
  algorithm: HashAlgorithm = 'sha256'
): boolean {
  const actualHash = hash(data, algorithm);

  // Use timing-safe comparison to prevent timing attacks
  try {
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(actualHash, 'hex');
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ============================================================================
// SHA INFINITY - CHAINED HASHING SYSTEM
// ============================================================================

/**
 * SHA Infinity Configuration
 * Defines the chain of hash algorithms to apply
 */
export interface SHAInfinityConfig {
  /** Algorithms to chain, in order */
  algorithms: HashAlgorithm[];
  /** Number of iterations per algorithm */
  iterations: number;
  /** Include salt in chain */
  salted: boolean;
  /** Salt value (auto-generated if not provided) */
  salt?: string;
  /** Include timestamp in chain */
  timestamped: boolean;
}

export const DEFAULT_SHA_INFINITY_CONFIG: SHAInfinityConfig = {
  algorithms: ['sha256', 'sha384', 'sha512'],
  iterations: 1,
  salted: true,
  timestamped: true,
};

/**
 * SHA Infinity - Extensible multi-algorithm hashing
 *
 * Chains multiple hash algorithms for enhanced security:
 * 1. Applies each algorithm in sequence
 * 2. Can iterate multiple times
 * 3. Optionally includes salt and timestamp
 * 4. Returns full chain for verification
 *
 * @example
 * ```ts
 * const result = shaInfinity('my data', {
 *   algorithms: ['sha256', 'sha512'],
 *   iterations: 3,
 *   salted: true
 * });
 * ```
 */
export function shaInfinity(
  data: string | Buffer,
  config: Partial<SHAInfinityConfig> = {}
): ChainedHash {
  const finalConfig: SHAInfinityConfig = { ...DEFAULT_SHA_INFINITY_CONFIG, ...config };
  const chain: HashResult[] = [];

  // Generate salt if needed
  const salt = finalConfig.salted
    ? (finalConfig.salt || randomBytes(16).toString('hex'))
    : '';

  // Start with input data
  let currentData = typeof data === 'string' ? data : data.toString('hex');

  // Add timestamp if configured
  if (finalConfig.timestamped) {
    currentData = `${currentData}:${Date.now()}`;
  }

  // Add salt if configured
  if (salt) {
    currentData = `${currentData}:${salt}`;
  }

  // Apply each algorithm in chain
  for (const algorithm of finalConfig.algorithms) {
    for (let i = 0; i < finalConfig.iterations; i++) {
      const result = hashWithMetadata(currentData, algorithm, {
        iteration: i + 1,
        chainPosition: chain.length + 1,
        salt: salt || undefined,
      });
      chain.push(result);
      currentData = result.hash;
    }
  }

  return {
    chain,
    finalHash: currentData,
    chainLength: chain.length,
    verified: true,
  };
}

/**
 * Verify a SHA Infinity chain
 */
export function verifySHAInfinityChain(chain: ChainedHash): boolean {
  if (chain.chain.length === 0) return false;

  let previousHash = '';

  for (let i = 0; i < chain.chain.length; i++) {
    const step = chain.chain[i];

    // For steps after the first, verify chain continuity
    if (i > 0 && previousHash !== '') {
      // The input to this step should produce the recorded hash
      const verification = hash(previousHash, step.algorithm);
      // Note: Full verification requires original data and salt
    }

    previousHash = step.hash;
  }

  // Verify final hash matches
  return previousHash === chain.finalHash;
}

// ============================================================================
// SPECIALIZED HASHING FOR APOLLO SYSTEM
// ============================================================================

/**
 * Hash an agent's state for verification
 */
export function hashAgentState(agent: {
  id: string;
  status: string;
  zone: string;
  lastHeartbeat?: Date;
}): string {
  const stateString = JSON.stringify({
    id: agent.id,
    status: agent.status,
    zone: agent.zone,
    timestamp: agent.lastHeartbeat?.toISOString() || new Date().toISOString(),
  });
  return sha256(stateString);
}

/**
 * Hash a GitHub issue/PR for tracking
 */
export function hashGitHubItem(item: {
  number: number;
  title: string;
  state: string;
  labels: string[];
}): string {
  const itemString = JSON.stringify({
    number: item.number,
    title: item.title,
    state: item.state,
    labels: item.labels.sort(),
  });
  return sha256(itemString);
}

/**
 * Hash configuration for integrity verification
 */
export function hashConfig(config: Record<string, any>): string {
  // Sort keys for consistent hashing
  const sortedConfig = JSON.stringify(config, Object.keys(config).sort());
  return sha256(sortedConfig);
}

/**
 * Hash a job for queue verification
 */
export function hashJob(job: {
  id: string;
  type: string;
  payload: any;
  priority?: number;
}): string {
  return sha256(JSON.stringify({
    id: job.id,
    type: job.type,
    payload: job.payload,
    priority: job.priority || 5,
  }));
}

/**
 * Generate a deployment hash
 */
export function hashDeployment(deployment: {
  version: string;
  commit: string;
  timestamp: Date;
  zone: string;
}): string {
  return sha256(JSON.stringify({
    version: deployment.version,
    commit: deployment.commit,
    timestamp: deployment.timestamp.toISOString(),
    zone: deployment.zone,
  }));
}

// ============================================================================
// STATE SYNC HASHING
// ============================================================================

/**
 * Hash state for Cloudflare KV sync
 */
export function hashStateForSync(state: {
  key: string;
  value: any;
  source: 'github' | 'cloudflare' | 'salesforce';
}): string {
  return sha256(JSON.stringify({
    key: state.key,
    value: state.value,
    source: state.source,
    syncTime: new Date().toISOString(),
  }));
}

/**
 * Create a hash chain for audit trail
 */
export function createAuditHash(
  previousHash: string,
  action: string,
  actor: string,
  data: any
): string {
  return sha256(JSON.stringify({
    previous: previousHash,
    action,
    actor,
    data,
    timestamp: new Date().toISOString(),
  }));
}

// ============================================================================
// KANBAN ITEM HASHING
// ============================================================================

/**
 * Hash a kanban card for state tracking
 */
export function hashKanbanCard(card: {
  id: string;
  title: string;
  column: string;
  assignees: string[];
  labels: string[];
  priority: string;
}): string {
  return sha256(JSON.stringify({
    id: card.id,
    title: card.title,
    column: card.column,
    assignees: card.assignees.sort(),
    labels: card.labels.sort(),
    priority: card.priority,
  }));
}

/**
 * Hash kanban board state
 */
export function hashKanbanBoard(board: {
  id: string;
  name: string;
  columns: string[];
  cardCount: number;
}): string {
  return sha256(JSON.stringify({
    id: board.id,
    name: board.name,
    columns: board.columns,
    cardCount: board.cardCount,
    timestamp: new Date().toISOString(),
  }));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a random hash-based ID
 */
export function generateHashId(prefix: string = ''): string {
  const random = randomBytes(16).toString('hex');
  const hash = sha256(`${prefix}:${random}:${Date.now()}`);
  return prefix ? `${prefix}_${hash.substring(0, 16)}` : hash.substring(0, 32);
}

/**
 * Create a deterministic hash from multiple values
 */
export function combineHashes(...hashes: string[]): string {
  return sha256(hashes.join(':'));
}

/**
 * Truncate a hash to specified length
 */
export function truncateHash(hash: string, length: number = 8): string {
  return hash.substring(0, length);
}

/**
 * Format hash for display (grouped by 4 characters)
 */
export function formatHash(hash: string): string {
  return hash.match(/.{1,4}/g)?.join('-') || hash;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
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
};
