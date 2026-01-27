/**
 * Apollo 30K - State Management System
 *
 * CRM-style state management where:
 * - GitHub holds the code/files
 * - Cloudflare KV holds the state/details
 * - Salesforce holds CRM data
 *
 * All state changes are SHA-256 verified and synced across systems.
 *
 * @package @blackroad/apollo-30k-deployment
 * @author BlackRoad OS, Inc.
 * @license Proprietary
 */

import { z } from 'zod';
import { sha256, hashStateForSync, hashKanbanCard, createAuditHash } from '../src/utils/hashing';

// ============================================================================
// STATE SCHEMAS
// ============================================================================

export const StateSourceSchema = z.enum(['github', 'cloudflare', 'salesforce', 'local']);
export type StateSource = z.infer<typeof StateSourceSchema>;

export const SyncStatusSchema = z.enum(['synced', 'pending', 'conflict', 'error']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const StateItemSchema = z.object({
  key: z.string(),
  value: z.any(),
  source: StateSourceSchema,
  hash: z.string(),
  lastModified: z.date(),
  syncStatus: SyncStatusSchema,
  version: z.number(),
});

export type StateItem = z.infer<typeof StateItemSchema>;

export const KanbanStateSchema = z.object({
  cardId: z.string(),
  issueNumber: z.number().optional(),
  prNumber: z.number().optional(),
  title: z.string(),
  column: z.string(),
  priority: z.string(),
  assignees: z.array(z.string()),
  labels: z.array(z.string()),
  integrations: z.array(z.string()),
  hash: z.string(),
  cloudflareKvKey: z.string().optional(),
  salesforceId: z.string().optional(),
  lastSync: z.date(),
});

export type KanbanState = z.infer<typeof KanbanStateSchema>;

// ============================================================================
// STATE MANAGER CLASS
// ============================================================================

export class StateManager {
  private states: Map<string, StateItem>;
  private auditLog: string[];
  private lastAuditHash: string;

  constructor() {
    this.states = new Map();
    this.auditLog = [];
    this.lastAuditHash = sha256('genesis');
  }

  // ---------------------------------------------------------------------------
  // CORE STATE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Set a state value
   */
  set(key: string, value: any, source: StateSource = 'local'): StateItem {
    const existing = this.states.get(key);
    const version = existing ? existing.version + 1 : 1;

    const stateItem: StateItem = {
      key,
      value,
      source,
      hash: hashStateForSync({ key, value, source }),
      lastModified: new Date(),
      syncStatus: 'pending',
      version,
    };

    this.states.set(key, stateItem);
    this.addAuditEntry('set', source, { key, value });

    return stateItem;
  }

  /**
   * Get a state value
   */
  get(key: string): StateItem | undefined {
    return this.states.get(key);
  }

  /**
   * Delete a state value
   */
  delete(key: string): boolean {
    const existing = this.states.get(key);
    if (existing) {
      this.addAuditEntry('delete', existing.source, { key });
      return this.states.delete(key);
    }
    return false;
  }

  /**
   * Get all states
   */
  getAll(): StateItem[] {
    return Array.from(this.states.values());
  }

  /**
   * Get states by source
   */
  getBySource(source: StateSource): StateItem[] {
    return this.getAll().filter(s => s.source === source);
  }

  /**
   * Get states by sync status
   */
  getBySyncStatus(status: SyncStatus): StateItem[] {
    return this.getAll().filter(s => s.syncStatus === status);
  }

  // ---------------------------------------------------------------------------
  // SYNC OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Mark state as synced
   */
  markSynced(key: string): void {
    const state = this.states.get(key);
    if (state) {
      state.syncStatus = 'synced';
      state.lastModified = new Date();
    }
  }

  /**
   * Mark state as having conflict
   */
  markConflict(key: string): void {
    const state = this.states.get(key);
    if (state) {
      state.syncStatus = 'conflict';
    }
  }

  /**
   * Resolve conflict with specific value
   */
  resolveConflict(key: string, value: any, source: StateSource): StateItem {
    return this.set(key, value, source);
  }

  /**
   * Get pending sync items
   */
  getPendingSync(): StateItem[] {
    return this.getBySyncStatus('pending');
  }

  // ---------------------------------------------------------------------------
  // CLOUDFLARE KV SYNC
  // ---------------------------------------------------------------------------

  /**
   * Sync state to Cloudflare KV
   */
  async syncToCloudflareKV(
    accountId: string,
    namespaceId: string,
    apiToken: string
  ): Promise<{ success: string[]; failed: string[] }> {
    const pending = this.getPendingSync();
    const success: string[] = [];
    const failed: string[] = [];

    for (const state of pending) {
      try {
        const kvKey = `state:${state.key}`;
        const kvValue = JSON.stringify({
          value: state.value,
          hash: state.hash,
          version: state.version,
          lastModified: state.lastModified.toISOString(),
        });

        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${kvKey}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'text/plain',
            },
            body: kvValue,
          }
        );

        if (response.ok) {
          this.markSynced(state.key);
          success.push(state.key);
        } else {
          failed.push(state.key);
        }
      } catch (error) {
        failed.push(state.key);
      }
    }

    return { success, failed };
  }

  /**
   * Fetch state from Cloudflare KV
   */
  async fetchFromCloudflareKV(
    accountId: string,
    namespaceId: string,
    apiToken: string,
    key: string
  ): Promise<StateItem | null> {
    try {
      const kvKey = `state:${key}`;
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${kvKey}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          key,
          value: data.value,
          hash: data.hash,
          source: 'cloudflare',
          lastModified: new Date(data.lastModified),
          syncStatus: 'synced',
          version: data.version,
        };
      }
    } catch (error) {
      console.error(`[StateManager] Failed to fetch from KV: ${error}`);
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // GITHUB SYNC
  // ---------------------------------------------------------------------------

  /**
   * Convert GitHub issue to state
   */
  issueToState(issue: {
    number: number;
    title: string;
    state: string;
    labels: { name: string }[];
    assignees: { login: string }[];
  }): StateItem {
    const key = `issue:${issue.number}`;
    const value = {
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels.map(l => l.name),
      assignees: issue.assignees.map(a => a.login),
    };

    return this.set(key, value, 'github');
  }

  /**
   * Convert GitHub PR to state
   */
  prToState(pr: {
    number: number;
    title: string;
    state: string;
    merged: boolean;
    labels: { name: string }[];
    assignees: { login: string }[];
  }): StateItem {
    const key = `pr:${pr.number}`;
    const value = {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: pr.merged,
      labels: pr.labels.map(l => l.name),
      assignees: pr.assignees.map(a => a.login),
    };

    return this.set(key, value, 'github');
  }

  // ---------------------------------------------------------------------------
  // SALESFORCE SYNC
  // ---------------------------------------------------------------------------

  /**
   * Sync state to Salesforce
   */
  async syncToSalesforce(
    instanceUrl: string,
    accessToken: string,
    objectType: string = 'AgentDeployment__c'
  ): Promise<{ success: string[]; failed: string[] }> {
    const pending = this.getPendingSync().filter(s =>
      s.key.startsWith('issue:') || s.key.startsWith('pr:')
    );
    const success: string[] = [];
    const failed: string[] = [];

    for (const state of pending) {
      try {
        const sfRecord = {
          Name: state.key,
          Status__c: state.value.state,
          SHA256_Hash__c: state.hash,
          Last_Sync__c: new Date().toISOString(),
          Source__c: state.source,
          Details__c: JSON.stringify(state.value),
        };

        const response = await fetch(
          `${instanceUrl}/services/data/v59.0/sobjects/${objectType}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sfRecord),
          }
        );

        if (response.ok) {
          this.markSynced(state.key);
          success.push(state.key);
        } else {
          failed.push(state.key);
        }
      } catch (error) {
        failed.push(state.key);
      }
    }

    return { success, failed };
  }

  // ---------------------------------------------------------------------------
  // KANBAN STATE MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Create kanban card state
   */
  createKanbanState(card: Omit<KanbanState, 'hash' | 'lastSync'>): KanbanState {
    const state: KanbanState = {
      ...card,
      hash: hashKanbanCard({
        id: card.cardId,
        title: card.title,
        column: card.column,
        assignees: card.assignees,
        labels: card.labels,
        priority: card.priority,
      }),
      lastSync: new Date(),
    };

    this.set(`kanban:${card.cardId}`, state, 'github');
    return state;
  }

  /**
   * Update kanban card column
   */
  moveKanbanCard(cardId: string, newColumn: string): KanbanState | null {
    const existing = this.get(`kanban:${cardId}`);
    if (!existing) return null;

    const updatedCard: KanbanState = {
      ...existing.value,
      column: newColumn,
      hash: hashKanbanCard({
        ...existing.value,
        column: newColumn,
      }),
      lastSync: new Date(),
    };

    this.set(`kanban:${cardId}`, updatedCard, 'github');
    return updatedCard;
  }

  /**
   * Get all kanban cards in a column
   */
  getKanbanColumn(column: string): KanbanState[] {
    return this.getAll()
      .filter(s => s.key.startsWith('kanban:') && s.value.column === column)
      .map(s => s.value);
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOG
  // ---------------------------------------------------------------------------

  /**
   * Add audit entry
   */
  private addAuditEntry(action: string, actor: string, data: any): void {
    this.lastAuditHash = createAuditHash(this.lastAuditHash, action, actor, data);
    this.auditLog.push(this.lastAuditHash);
  }

  /**
   * Get audit log
   */
  getAuditLog(): string[] {
    return [...this.auditLog];
  }

  /**
   * Get last audit hash
   */
  getLastAuditHash(): string {
    return this.lastAuditHash;
  }

  // ---------------------------------------------------------------------------
  // VERIFICATION
  // ---------------------------------------------------------------------------

  /**
   * Verify state integrity
   */
  verifyState(key: string): boolean {
    const state = this.states.get(key);
    if (!state) return false;

    const expectedHash = hashStateForSync({
      key: state.key,
      value: state.value,
      source: state.source,
    });

    return state.hash === expectedHash;
  }

  /**
   * Verify all states
   */
  verifyAllStates(): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const key of this.states.keys()) {
      if (this.verifyState(key)) {
        valid.push(key);
      } else {
        invalid.push(key);
      }
    }

    return { valid, invalid };
  }

  // ---------------------------------------------------------------------------
  // EXPORT/IMPORT
  // ---------------------------------------------------------------------------

  /**
   * Export all states to JSON
   */
  export(): string {
    const data = {
      states: Object.fromEntries(this.states),
      auditLog: this.auditLog,
      lastAuditHash: this.lastAuditHash,
      exportedAt: new Date().toISOString(),
      exportHash: sha256(JSON.stringify(Object.fromEntries(this.states))),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import states from JSON
   */
  import(json: string): void {
    const data = JSON.parse(json);

    for (const [key, value] of Object.entries(data.states)) {
      this.states.set(key, value as StateItem);
    }

    if (data.auditLog) {
      this.auditLog = data.auditLog;
    }

    if (data.lastAuditHash) {
      this.lastAuditHash = data.lastAuditHash;
    }
  }
}

// Export singleton instance
export const stateManager = new StateManager();

export default StateManager;
