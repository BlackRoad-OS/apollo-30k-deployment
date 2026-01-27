/**
 * Apollo 30K - Multi-Service Integration Configuration
 *
 * Manages connections to all external services:
 * - Cloud: Cloudflare, Railway, DigitalOcean, Vercel
 * - CRM: Salesforce
 * - AI: Claude API
 * - Edge: Raspberry Pi, Mobile (iSH, Shellfish, Pyto, Working Copy)
 * - Tools: Termius, GitHub
 *
 * @package @blackroad/apollo-30k-deployment
 * @author BlackRoad OS, Inc.
 * @license Proprietary
 */

import { z } from 'zod';

// ============================================================================
// INTEGRATION SCHEMAS
// ============================================================================

export const IntegrationStatusSchema = z.enum([
  'connected',
  'disconnected',
  'degraded',
  'error',
  'maintenance'
]);

export const IntegrationTypeSchema = z.enum([
  'cloud',
  'crm',
  'ai',
  'edge',
  'mobile',
  'tool',
  'database',
  'queue'
]);

export const IntegrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: IntegrationTypeSchema,
  status: IntegrationStatusSchema,
  endpoint: z.string().url().optional(),
  healthEndpoint: z.string().optional(),
  lastSync: z.date().optional(),
  syncInterval: z.number().default(60000), // 1 minute default
  config: z.record(z.any()).optional(),
  sha256Hash: z.string().optional(),
});

export type Integration = z.infer<typeof IntegrationSchema>;
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;
export type IntegrationType = z.infer<typeof IntegrationTypeSchema>;

// ============================================================================
// INTEGRATION CONFIGURATIONS
// ============================================================================

export const INTEGRATIONS: Record<string, Integration> = {
  // -------------------------------------------------------------------------
  // CLOUD SERVICES
  // -------------------------------------------------------------------------

  cloudflare: {
    id: 'cloudflare',
    name: 'Cloudflare',
    type: 'cloud',
    status: 'connected',
    endpoint: 'https://api.cloudflare.com/client/v4',
    healthEndpoint: '/user/tokens/verify',
    syncInterval: 30000,
    config: {
      services: ['workers', 'kv', 'd1', 'pages', 'r2'],
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      zones: ['apollo-agents', 'blackroad-edge'],
    },
  },

  railway: {
    id: 'railway',
    name: 'Railway',
    type: 'cloud',
    status: 'connected',
    endpoint: 'https://backboard.railway.app/graphql/v2',
    healthEndpoint: '/health',
    syncInterval: 30000,
    config: {
      projectId: process.env.RAILWAY_PROJECT_ID,
      services: 9,
      agentCapacity: 20000,
    },
  },

  digitalocean: {
    id: 'digitalocean',
    name: 'DigitalOcean',
    type: 'cloud',
    status: 'connected',
    endpoint: 'https://api.digitalocean.com/v2',
    healthEndpoint: '/account',
    syncInterval: 60000,
    config: {
      droplets: ['heavy-compute-1', 'batch-processor-1'],
      agentCapacity: 1000,
    },
  },

  vercel: {
    id: 'vercel',
    name: 'Vercel',
    type: 'cloud',
    status: 'connected',
    endpoint: 'https://api.vercel.com',
    healthEndpoint: '/v2/user',
    syncInterval: 60000,
    config: {
      teamId: process.env.VERCEL_TEAM_ID,
      projects: ['apollo-dashboard', 'agent-portal'],
    },
  },

  // -------------------------------------------------------------------------
  // CRM & STATE MANAGEMENT
  // -------------------------------------------------------------------------

  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    type: 'crm',
    status: 'connected',
    endpoint: process.env.SALESFORCE_INSTANCE_URL,
    healthEndpoint: '/services/data/v59.0',
    syncInterval: 120000,
    config: {
      objects: ['Lead', 'Opportunity', 'Account', 'AgentDeployment__c'],
      syncFields: ['status', 'priority', 'assignee', 'sha256Hash'],
      stateSync: true,
    },
  },

  cloudflareKV: {
    id: 'cloudflare-kv',
    name: 'Cloudflare KV (State Store)',
    type: 'database',
    status: 'connected',
    endpoint: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces',
    syncInterval: 10000,
    config: {
      namespaces: {
        agents: '28ed114677e54e23ad10cc7901f1fd98',
        health: '416d5f01ed5e4843b98a9e251737e219',
        state: process.env.CLOUDFLARE_KV_STATE_ID,
        kanban: process.env.CLOUDFLARE_KV_KANBAN_ID,
      },
      ttl: 3600, // 1 hour
    },
  },

  // -------------------------------------------------------------------------
  // AI SERVICES
  // -------------------------------------------------------------------------

  claude: {
    id: 'claude',
    name: 'Claude API (Anthropic)',
    type: 'ai',
    status: 'connected',
    endpoint: 'https://api.anthropic.com/v1',
    healthEndpoint: '/messages',
    syncInterval: 60000,
    config: {
      models: ['claude-opus-4-5-20251101', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
      maxTokens: 8192,
      agentCores: ['aria', 'lucidia', 'silas', 'cecilia', 'cadence', 'alice'],
    },
  },

  // -------------------------------------------------------------------------
  // EDGE & IOT
  // -------------------------------------------------------------------------

  raspberryPi: {
    id: 'raspberry-pi',
    name: 'Raspberry Pi Network',
    type: 'edge',
    status: 'connected',
    syncInterval: 60000,
    config: {
      hosts: (process.env.PI_HOSTS || '').split(',').filter(Boolean),
      sshUser: process.env.PI_SSH_USER || 'pi',
      agentCapacity: 1000,
      capabilities: ['edge-ai', 'iot', 'offline'],
    },
  },

  // -------------------------------------------------------------------------
  // MOBILE & TERMINAL TOOLS
  // -------------------------------------------------------------------------

  termius: {
    id: 'termius',
    name: 'Termius',
    type: 'tool',
    status: 'connected',
    endpoint: 'https://api.termius.com/api/v3',
    syncInterval: 300000,
    config: {
      groups: ['apollo-agents', 'pi-cluster', 'cloud-vms'],
      syncHosts: true,
    },
  },

  ish: {
    id: 'ish',
    name: 'iSH (iOS Shell)',
    type: 'mobile',
    status: 'connected',
    syncInterval: 300000,
    config: {
      capabilities: ['alpine-linux', 'git', 'python', 'ssh'],
      syncMethod: 'working-copy',
    },
  },

  shellfish: {
    id: 'shellfish',
    name: 'Shellfish (iOS SSH)',
    type: 'mobile',
    status: 'connected',
    syncInterval: 300000,
    config: {
      features: ['sftp', 'ssh', 'mosh', 'port-forwarding'],
      keySync: true,
    },
  },

  workingCopy: {
    id: 'working-copy',
    name: 'Working Copy',
    type: 'mobile',
    status: 'connected',
    syncInterval: 60000,
    config: {
      repos: ['apollo-30k-deployment', 'blackroad-os'],
      autoSync: true,
      features: ['git', 'push', 'pull', 'clone', 'diff'],
    },
  },

  pyto: {
    id: 'pyto',
    name: 'Pyto (iOS Python)',
    type: 'mobile',
    status: 'connected',
    syncInterval: 300000,
    config: {
      pythonVersion: '3.11',
      packages: ['requests', 'numpy', 'pandas', 'anthropic'],
      scripts: ['agent-monitor.py', 'health-check.py'],
    },
  },

  // -------------------------------------------------------------------------
  // GITHUB
  // -------------------------------------------------------------------------

  github: {
    id: 'github',
    name: 'GitHub',
    type: 'tool',
    status: 'connected',
    endpoint: 'https://api.github.com',
    healthEndpoint: '/user',
    syncInterval: 30000,
    config: {
      org: 'BlackRoad-OS',
      repos: ['apollo-30k-deployment'],
      projects: true,
      actions: true,
      webhooks: true,
    },
  },

  // -------------------------------------------------------------------------
  // DATABASES & QUEUES
  // -------------------------------------------------------------------------

  redis: {
    id: 'redis',
    name: 'Redis (Upstash/Railway)',
    type: 'queue',
    status: 'connected',
    endpoint: process.env.REDIS_URL,
    syncInterval: 10000,
    config: {
      queues: ['task-execution', 'model-inference', 'data-processing', 'monitoring', 'coordination'],
      maxJobsPerSecond: 1000,
    },
  },

  postgresql: {
    id: 'postgresql',
    name: 'PostgreSQL',
    type: 'database',
    status: 'connected',
    endpoint: process.env.DATABASE_URL,
    syncInterval: 60000,
    config: {
      schemas: ['agents', 'jobs', 'metrics', 'audit'],
    },
  },

  d1: {
    id: 'd1',
    name: 'Cloudflare D1',
    type: 'database',
    status: 'connected',
    syncInterval: 30000,
    config: {
      databaseId: '79f8b80d-3bb5-4dd4-beee-a77a1084b574',
      databaseName: 'apollo-agent-registry',
    },
  },
};

// ============================================================================
// INTEGRATION MANAGER CLASS
// ============================================================================

export class IntegrationManager {
  private integrations: Map<string, Integration>;
  private healthChecks: Map<string, NodeJS.Timeout>;

  constructor() {
    this.integrations = new Map(Object.entries(INTEGRATIONS));
    this.healthChecks = new Map();
  }

  /**
   * Get all integrations
   */
  getAll(): Integration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Get integration by ID
   */
  get(id: string): Integration | undefined {
    return this.integrations.get(id);
  }

  /**
   * Get integrations by type
   */
  getByType(type: IntegrationType): Integration[] {
    return this.getAll().filter(i => i.type === type);
  }

  /**
   * Get integrations by status
   */
  getByStatus(status: IntegrationStatus): Integration[] {
    return this.getAll().filter(i => i.status === status);
  }

  /**
   * Update integration status
   */
  updateStatus(id: string, status: IntegrationStatus): void {
    const integration = this.integrations.get(id);
    if (integration) {
      integration.status = status;
      integration.lastSync = new Date();
    }
  }

  /**
   * Check health of an integration
   */
  async checkHealth(id: string): Promise<IntegrationStatus> {
    const integration = this.get(id);
    if (!integration || !integration.endpoint || !integration.healthEndpoint) {
      return 'disconnected';
    }

    try {
      const url = `${integration.endpoint}${integration.healthEndpoint}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(id),
      });

      if (response.ok) {
        this.updateStatus(id, 'connected');
        return 'connected';
      } else if (response.status >= 500) {
        this.updateStatus(id, 'error');
        return 'error';
      } else {
        this.updateStatus(id, 'degraded');
        return 'degraded';
      }
    } catch (error) {
      this.updateStatus(id, 'disconnected');
      return 'disconnected';
    }
  }

  /**
   * Get auth headers for an integration
   */
  private getAuthHeaders(id: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (id) {
      case 'cloudflare':
      case 'cloudflare-kv':
        if (process.env.CLOUDFLARE_API_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`;
        }
        break;
      case 'railway':
        if (process.env.RAILWAY_API_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.RAILWAY_API_TOKEN}`;
        }
        break;
      case 'digitalocean':
        if (process.env.DIGITALOCEAN_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.DIGITALOCEAN_TOKEN}`;
        }
        break;
      case 'vercel':
        if (process.env.VERCEL_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.VERCEL_TOKEN}`;
        }
        break;
      case 'salesforce':
        if (process.env.SALESFORCE_ACCESS_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`;
        }
        break;
      case 'claude':
        if (process.env.ANTHROPIC_API_KEY) {
          headers['x-api-key'] = process.env.ANTHROPIC_API_KEY;
          headers['anthropic-version'] = '2023-06-01';
        }
        break;
      case 'github':
        if (process.env.GITHUB_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
        }
        break;
    }

    return headers;
  }

  /**
   * Start health monitoring for all integrations
   */
  startHealthMonitoring(): void {
    for (const [id, integration] of this.integrations) {
      if (integration.endpoint) {
        const interval = setInterval(
          () => this.checkHealth(id),
          integration.syncInterval
        );
        this.healthChecks.set(id, interval);
      }
    }
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    for (const interval of this.healthChecks.values()) {
      clearInterval(interval);
    }
    this.healthChecks.clear();
  }

  /**
   * Get integration summary for kanban board
   */
  getSummary(): Record<IntegrationStatus, number> {
    const summary: Record<IntegrationStatus, number> = {
      connected: 0,
      disconnected: 0,
      degraded: 0,
      error: 0,
      maintenance: 0,
    };

    for (const integration of this.integrations.values()) {
      summary[integration.status]++;
    }

    return summary;
  }
}

// Export singleton instance
export const integrationManager = new IntegrationManager();

// ============================================================================
// ENDPOINT REGISTRY
// ============================================================================

export const ENDPOINTS = {
  // Cloud APIs
  cloudflare: {
    base: 'https://api.cloudflare.com/client/v4',
    workers: '/accounts/{account_id}/workers/scripts',
    kv: '/accounts/{account_id}/storage/kv/namespaces',
    d1: '/accounts/{account_id}/d1/database',
    pages: '/accounts/{account_id}/pages/projects',
  },
  railway: {
    base: 'https://backboard.railway.app',
    graphql: '/graphql/v2',
    deploy: '/deploy',
  },
  digitalocean: {
    base: 'https://api.digitalocean.com/v2',
    droplets: '/droplets',
    apps: '/apps',
  },
  vercel: {
    base: 'https://api.vercel.com',
    deployments: '/v13/deployments',
    projects: '/v9/projects',
  },
  salesforce: {
    base: process.env.SALESFORCE_INSTANCE_URL || 'https://login.salesforce.com',
    rest: '/services/data/v59.0',
    sobjects: '/services/data/v59.0/sobjects',
  },
  claude: {
    base: 'https://api.anthropic.com/v1',
    messages: '/messages',
    completions: '/complete',
  },
  github: {
    base: 'https://api.github.com',
    repos: '/repos/{owner}/{repo}',
    projects: '/projects',
    issues: '/repos/{owner}/{repo}/issues',
    pulls: '/repos/{owner}/{repo}/pulls',
  },
} as const;

export default INTEGRATIONS;
