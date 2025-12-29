/**
 * Health Monitoring System - 30-second health checks for all agents
 * Runs as Cloudflare Worker with Cron Trigger
 */

import type { Agent, AgentRegistryDB } from '../registry/agent-registry.js'

export interface HealthCheckResult {
  agentId: string
  zone: Agent['zone']
  healthy: boolean
  latency?: number
  error?: string
  timestamp: Date
}

export interface HealthMetrics {
  totalAgents: number
  healthyAgents: number
  unhealthyAgents: number
  staleAgents: number
  healthPercentage: number
  byZone: Record<
    Agent['zone'],
    {
      total: number
      healthy: number
      unhealthy: number
      stale: number
    }
  >
  lastCheck: Date
}

/**
 * Health Monitor - Checks agent health and triggers self-healing
 */
export class HealthMonitor {
  constructor(
    private registry: AgentRegistryDB,
    private heartbeatThresholdMinutes: number = 5
  ) {}

  /**
   * Check health of a single agent
   */
  async checkAgent(agentId: string): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      const agent = await this.registry.getAgent(agentId)

      if (!agent) {
        return {
          agentId,
          zone: 'railway',
          healthy: false,
          error: 'Agent not found',
          timestamp: new Date(),
        }
      }

      const healthy = this.isAgentHealthy(agent)
      const latency = Date.now() - startTime

      return {
        agentId,
        zone: agent.zone,
        healthy,
        latency,
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        agentId,
        zone: 'railway',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      }
    }
  }

  /**
   * Check if agent is healthy based on heartbeat and status
   */
  private isAgentHealthy(agent: Agent): boolean {
    if (agent.status !== 'active') {
      return false
    }

    if (!agent.lastHeartbeat) {
      return false
    }

    const now = Date.now()
    const lastHeartbeat = agent.lastHeartbeat.getTime()
    const thresholdMs = this.heartbeatThresholdMinutes * 60 * 1000

    return now - lastHeartbeat < thresholdMs
  }

  /**
   * Check health of all agents in a zone
   */
  async checkZone(zone: Agent['zone']): Promise<HealthCheckResult[]> {
    const agents = await this.registry.listAgents({ zone, status: 'active' })
    return Promise.all(agents.map((agent) => this.checkAgent(agent.id)))
  }

  /**
   * Check health of all agents across all zones
   */
  async checkAll(): Promise<HealthCheckResult[]> {
    const zones: Agent['zone'][] = ['railway', 'cloudflare', 'digitalocean', 'pi']
    const results = await Promise.all(zones.map((zone) => this.checkZone(zone)))
    return results.flat()
  }

  /**
   * Get overall health metrics
   */
  async getHealthMetrics(): Promise<HealthMetrics> {
    const agents = await this.registry.listAgents()
    const staleAgents = await this.registry.getStaleAgents(
      this.heartbeatThresholdMinutes
    )

    const byZone: HealthMetrics['byZone'] = {
      railway: { total: 0, healthy: 0, unhealthy: 0, stale: 0 },
      cloudflare: { total: 0, healthy: 0, unhealthy: 0, stale: 0 },
      digitalocean: { total: 0, healthy: 0, unhealthy: 0, stale: 0 },
      pi: { total: 0, healthy: 0, unhealthy: 0, stale: 0 },
    }

    let healthyCount = 0
    let unhealthyCount = 0

    for (const agent of agents) {
      byZone[agent.zone].total++

      if (this.isAgentHealthy(agent)) {
        healthyCount++
        byZone[agent.zone].healthy++
      } else {
        unhealthyCount++
        byZone[agent.zone].unhealthy++
      }
    }

    for (const agent of staleAgents) {
      byZone[agent.zone].stale++
    }

    return {
      totalAgents: agents.length,
      healthyAgents: healthyCount,
      unhealthyAgents: unhealthyCount,
      staleAgents: staleAgents.length,
      healthPercentage: agents.length > 0 ? (healthyCount / agents.length) * 100 : 0,
      byZone,
      lastCheck: new Date(),
    }
  }

  /**
   * Get stale agents that need healing
   */
  async getStaleAgents(): Promise<Agent[]> {
    return this.registry.getStaleAgents(this.heartbeatThresholdMinutes)
  }

  /**
   * Mark an agent as unhealthy
   */
  async markUnhealthy(agentId: string): Promise<void> {
    await this.registry.updateAgentStatus(agentId, 'error')
  }

  /**
   * Run health check cycle (called by cron)
   */
  async runHealthCheckCycle(): Promise<{
    metrics: HealthMetrics
    staleAgents: Agent[]
    actionsTaken: number
  }> {
    console.log('[HealthMonitor] Starting health check cycle...')

    const metrics = await this.getHealthMetrics()
    const staleAgents = await this.getStaleAgents()

    console.log(`[HealthMonitor] Total agents: ${metrics.totalAgents}`)
    console.log(`[HealthMonitor] Healthy: ${metrics.healthyAgents} (${metrics.healthPercentage.toFixed(2)}%)`)
    console.log(`[HealthMonitor] Stale: ${staleAgents.length}`)

    // Mark stale agents as error
    let actionsTaken = 0
    for (const agent of staleAgents) {
      await this.markUnhealthy(agent.id)
      actionsTaken++
      console.log(`[HealthMonitor] Marked ${agent.id} as unhealthy`)
    }

    return {
      metrics,
      staleAgents,
      actionsTaken,
    }
  }
}

/**
 * Cloudflare Worker health check handler
 */
export interface Env {
  DB: D1Database
  AGENTS_KV: KVNamespace
  HEALTH_CHECK_INTERVAL: string // cron expression
}

export default {
  /**
   * Scheduled health check (runs every 30 seconds)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const { D1AgentRegistry } = await import('../registry/agent-registry.js')
    const registry = new D1AgentRegistry(env.DB)
    const monitor = new HealthMonitor(registry, 5)

    const result = await monitor.runHealthCheckCycle()

    // Store metrics in KV for dashboard
    await env.AGENTS_KV.put(
      'health:latest',
      JSON.stringify(result.metrics),
      { expirationTtl: 300 } // 5 minutes
    )

    // Store stale agents list
    await env.AGENTS_KV.put(
      'health:stale',
      JSON.stringify(result.staleAgents.map((a) => a.id)),
      { expirationTtl: 300 }
    )

    console.log(`[HealthMonitor] Cycle complete. Actions taken: ${result.actionsTaken}`)
  },

  /**
   * HTTP handler for manual health checks and metrics retrieval
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // GET /health - Get latest health metrics
    if (url.pathname === '/health' && request.method === 'GET') {
      const metrics = await env.AGENTS_KV.get('health:latest', 'json')
      return Response.json(metrics || { error: 'No health data available' })
    }

    // GET /health/stale - Get stale agents
    if (url.pathname === '/health/stale' && request.method === 'GET') {
      const stale = await env.AGENTS_KV.get('health:stale', 'json')
      return Response.json(stale || [])
    }

    // POST /health/check - Trigger manual health check
    if (url.pathname === '/health/check' && request.method === 'POST') {
      const { D1AgentRegistry } = await import('../registry/agent-registry.js')
      const registry = new D1AgentRegistry(env.DB)
      const monitor = new HealthMonitor(registry, 5)

      const result = await monitor.runHealthCheckCycle()
      return Response.json(result)
    }

    return new Response('Not Found', { status: 404 })
  },
}
