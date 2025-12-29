/**
 * Agent Registry - D1 + KV system for tracking 30k agents
 * Handles agent registration, health tracking, and state management
 */

import { z } from 'zod'

// Agent schema
export const AgentSchema = z.object({
  id: z.string(),
  hash: z.string(), // PS-SHA-∞ verified hash
  core: z.enum(['aria', 'lucidia', 'silas', 'cecilia', 'cadence', 'alice']),
  capability: z.string(),
  zone: z.enum(['railway', 'cloudflare', 'digitalocean', 'pi']),
  status: z.enum(['active', 'paused', 'error', 'offline']),
  healthScore: z.number().min(0).max(100).default(100),
  lastHeartbeat: z.date().optional(),
  tasksCompleted: z.number().default(0),
  tasksFailed: z.number().default(0),
  createdAt: z.date().default(() => new Date()),
  metadata: z.record(z.any()).optional(),
})

export type Agent = z.infer<typeof AgentSchema>

// Agent Registry interface for D1
export interface AgentRegistryDB {
  getAgent(id: string): Promise<Agent | null>
  registerAgent(agent: Omit<Agent, 'createdAt'>): Promise<Agent>
  updateAgentStatus(id: string, status: Agent['status']): Promise<void>
  updateHeartbeat(id: string): Promise<void>
  incrementTasksCompleted(id: string): Promise<void>
  incrementTasksFailed(id: string): Promise<void>
  listAgents(filters?: {
    zone?: Agent['zone']
    status?: Agent['status']
    core?: Agent['core']
  }): Promise<Agent[]>
  getAgentCount(zone?: Agent['zone']): Promise<number>
  getHealthyAgents(): Promise<Agent[]>
  getStaleAgents(minutesThreshold: number): Promise<Agent[]>
}

// D1 Implementation
export class D1AgentRegistry implements AgentRegistryDB {
  constructor(private db: D1Database) {}

  async getAgent(id: string): Promise<Agent | null> {
    const result = await this.db
      .prepare('SELECT * FROM agents WHERE id = ?')
      .bind(id)
      .first()

    if (!result) return null

    return {
      ...result,
      lastHeartbeat: result.last_heartbeat ? new Date(result.last_heartbeat) : undefined,
      createdAt: new Date(result.created_at),
      metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
    } as Agent
  }

  async registerAgent(agent: Omit<Agent, 'createdAt'>): Promise<Agent> {
    const now = new Date()
    await this.db
      .prepare(`
        INSERT INTO agents (
          id, hash, core, capability, zone, status,
          health_score, last_heartbeat, tasks_completed,
          tasks_failed, created_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        agent.id,
        agent.hash,
        agent.core,
        agent.capability,
        agent.zone,
        agent.status,
        agent.healthScore,
        agent.lastHeartbeat?.toISOString() || null,
        agent.tasksCompleted,
        agent.tasksFailed,
        now.toISOString(),
        agent.metadata ? JSON.stringify(agent.metadata) : null
      )
      .run()

    return { ...agent, createdAt: now }
  }

  async updateAgentStatus(id: string, status: Agent['status']): Promise<void> {
    await this.db
      .prepare('UPDATE agents SET status = ? WHERE id = ?')
      .bind(status, id)
      .run()
  }

  async updateHeartbeat(id: string): Promise<void> {
    const now = new Date()
    await this.db
      .prepare('UPDATE agents SET last_heartbeat = ?, health_score = 100 WHERE id = ?')
      .bind(now.toISOString(), id)
      .run()
  }

  async incrementTasksCompleted(id: string): Promise<void> {
    await this.db
      .prepare('UPDATE agents SET tasks_completed = tasks_completed + 1 WHERE id = ?')
      .bind(id)
      .run()
  }

  async incrementTasksFailed(id: string): Promise<void> {
    await this.db
      .prepare(`
        UPDATE agents
        SET tasks_failed = tasks_failed + 1,
            health_score = GREATEST(0, health_score - 5)
        WHERE id = ?
      `)
      .bind(id)
      .run()
  }

  async listAgents(filters?: {
    zone?: Agent['zone']
    status?: Agent['status']
    core?: Agent['core']
  }): Promise<Agent[]> {
    let query = 'SELECT * FROM agents WHERE 1=1'
    const bindings: any[] = []

    if (filters?.zone) {
      query += ' AND zone = ?'
      bindings.push(filters.zone)
    }
    if (filters?.status) {
      query += ' AND status = ?'
      bindings.push(filters.status)
    }
    if (filters?.core) {
      query += ' AND core = ?'
      bindings.push(filters.core)
    }

    const results = await this.db.prepare(query).bind(...bindings).all()

    return results.results.map((r: any) => ({
      ...r,
      lastHeartbeat: r.last_heartbeat ? new Date(r.last_heartbeat) : undefined,
      createdAt: new Date(r.created_at),
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    })) as Agent[]
  }

  async getAgentCount(zone?: Agent['zone']): Promise<number> {
    const query = zone
      ? 'SELECT COUNT(*) as count FROM agents WHERE zone = ?'
      : 'SELECT COUNT(*) as count FROM agents'

    const result = await this.db
      .prepare(query)
      .bind(...(zone ? [zone] : []))
      .first()

    return (result?.count as number) || 0
  }

  async getHealthyAgents(): Promise<Agent[]> {
    return this.listAgents({ status: 'active' })
  }

  async getStaleAgents(minutesThreshold: number = 5): Promise<Agent[]> {
    const threshold = new Date(Date.now() - minutesThreshold * 60 * 1000)
    const results = await this.db
      .prepare(`
        SELECT * FROM agents
        WHERE status = 'active'
        AND (last_heartbeat < ? OR last_heartbeat IS NULL)
      `)
      .bind(threshold.toISOString())
      .all()

    return results.results.map((r: any) => ({
      ...r,
      lastHeartbeat: r.last_heartbeat ? new Date(r.last_heartbeat) : undefined,
      createdAt: new Date(r.created_at),
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    })) as Agent[]
  }
}

// KV Cache wrapper for fast agent lookups
export class AgentRegistryCache {
  constructor(
    private kv: KVNamespace,
    private registry: AgentRegistryDB
  ) {}

  async getAgent(id: string): Promise<Agent | null> {
    // Try cache first
    const cached = await this.kv.get(`agent:${id}`, 'json')
    if (cached) return cached as Agent

    // Fallback to D1
    const agent = await this.registry.getAgent(id)
    if (agent) {
      // Cache for 1 hour
      await this.kv.put(`agent:${id}`, JSON.stringify(agent), {
        expirationTtl: 3600,
      })
    }

    return agent
  }

  async invalidateCache(id: string): Promise<void> {
    await this.kv.delete(`agent:${id}`)
  }

  async registerAgent(agent: Omit<Agent, 'createdAt'>): Promise<Agent> {
    const registered = await this.registry.registerAgent(agent)
    // Cache immediately
    await this.kv.put(`agent:${registered.id}`, JSON.stringify(registered), {
      expirationTtl: 3600,
    })
    return registered
  }

  async updateHeartbeat(id: string): Promise<void> {
    await this.registry.updateHeartbeat(id)
    await this.invalidateCache(id)
  }
}
