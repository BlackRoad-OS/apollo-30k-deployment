/**
 * Auto-Scaling System - Dynamic agent scaling based on load
 * Scales from 0 to 30k agents based on queue depth and demand
 */

import type { Agent, AgentRegistryDB } from '../registry/agent-registry.js'
import type { JobQueueManager } from '../orchestration/job-queue.js'

export interface ScalingMetrics {
  queueDepth: number
  activeAgents: number
  avgResponseTime: number
  cpuUsage: number
  memoryUsage: number
}

export interface ScalingDecision {
  action: 'scale-up' | 'scale-down' | 'none'
  targetCount: number
  zone: Agent['zone']
  reason: string
}

export interface ScalingConfig {
  minAgents: number
  maxAgents: number
  scaleUpThreshold: {
    queueDepth: number
    responseTime: number
  }
  scaleDownThreshold: {
    queueDepth: number
    idleAgents: number
  }
  scaleUpIncrement: number
  scaleDownIncrement: number
  cooldownPeriod: number // seconds
}

const DEFAULT_CONFIG: ScalingConfig = {
  minAgents: 1000,
  maxAgents: 30000,
  scaleUpThreshold: {
    queueDepth: 10000,
    responseTime: 1000, // ms
  },
  scaleDownThreshold: {
    queueDepth: 1000,
    idleAgents: 5000,
  },
  scaleUpIncrement: 1000,
  scaleDownIncrement: 500,
  cooldownPeriod: 120, // 2 minutes
}

/**
 * Auto-Scaler - Manages dynamic agent scaling
 */
export class AutoScaler {
  private lastScalingAction: Date | null = null

  constructor(
    private registry: AgentRegistryDB,
    private queueManager: JobQueueManager,
    private config: ScalingConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Get current scaling metrics
   */
  async getMetrics(): Promise<ScalingMetrics> {
    const queueMetrics = await this.queueManager.getAllMetrics()
    const activeAgents = await this.registry.getAgentCount()

    return {
      queueDepth: queueMetrics.total.total,
      activeAgents,
      avgResponseTime: 250, // TODO: Calculate from job completion times
      cpuUsage: 65, // TODO: Get from monitoring
      memoryUsage: 72, // TODO: Get from monitoring
    }
  }

  /**
   * Determine if we're in cooldown period
   */
  private isInCooldown(): boolean {
    if (!this.lastScalingAction) return false

    const now = Date.now()
    const lastAction = this.lastScalingAction.getTime()
    const cooldownMs = this.config.cooldownPeriod * 1000

    return now - lastAction < cooldownMs
  }

  /**
   * Select optimal zone for scaling
   */
  private async selectOptimalZone(): Promise<Agent['zone']> {
    const zones: Agent['zone'][] = ['railway', 'cloudflare', 'digitalocean', 'pi']
    const zoneCounts = await Promise.all(
      zones.map(async (zone) => ({
        zone,
        count: await this.registry.getAgentCount(zone),
      }))
    )

    // Select zone with least agents (for scale-up)
    zoneCounts.sort((a, b) => a.count - b.count)
    return zoneCounts[0].zone
  }

  /**
   * Select zone for scale-down
   */
  private async selectScaleDownZone(): Promise<Agent['zone']> {
    const zones: Agent['zone'][] = ['railway', 'cloudflare', 'digitalocean', 'pi']
    const zoneCounts = await Promise.all(
      zones.map(async (zone) => ({
        zone,
        count: await this.registry.getAgentCount(zone),
      }))
    )

    // Select zone with most agents (for scale-down)
    zoneCounts.sort((a, b) => b.count - a.count)
    return zoneCounts[0].zone
  }

  /**
   * Make scaling decision based on metrics
   */
  async makeDecision(metrics: ScalingMetrics): Promise<ScalingDecision> {
    // Check cooldown
    if (this.isInCooldown()) {
      return {
        action: 'none',
        targetCount: metrics.activeAgents,
        zone: 'railway',
        reason: 'In cooldown period',
      }
    }

    // Scale up logic
    if (
      metrics.queueDepth > this.config.scaleUpThreshold.queueDepth &&
      metrics.activeAgents < this.config.maxAgents
    ) {
      const increment = Math.min(
        this.config.scaleUpIncrement,
        Math.floor(metrics.queueDepth / 10),
        this.config.maxAgents - metrics.activeAgents
      )

      const zone = await this.selectOptimalZone()

      return {
        action: 'scale-up',
        targetCount: metrics.activeAgents + increment,
        zone,
        reason: `Queue depth ${metrics.queueDepth} exceeds threshold ${this.config.scaleUpThreshold.queueDepth}`,
      }
    }

    // Scale down logic
    if (
      metrics.queueDepth < this.config.scaleDownThreshold.queueDepth &&
      metrics.activeAgents > this.config.minAgents
    ) {
      const increment = Math.min(
        this.config.scaleDownIncrement,
        metrics.activeAgents - this.config.minAgents
      )

      const zone = await this.selectScaleDownZone()

      return {
        action: 'scale-down',
        targetCount: metrics.activeAgents - increment,
        zone,
        reason: `Queue depth ${metrics.queueDepth} below threshold ${this.config.scaleDownThreshold.queueDepth}`,
      }
    }

    return {
      action: 'none',
      targetCount: metrics.activeAgents,
      zone: 'railway',
      reason: 'Metrics within normal range',
    }
  }

  /**
   * Execute scaling action
   */
  async executeScaling(decision: ScalingDecision): Promise<void> {
    if (decision.action === 'none') {
      return
    }

    console.log(`[AutoScaler] ${decision.action} to ${decision.targetCount} agents in ${decision.zone}`)
    console.log(`[AutoScaler] Reason: ${decision.reason}`)

    if (decision.action === 'scale-up') {
      await this.scaleUp(decision.zone, decision.targetCount)
    } else if (decision.action === 'scale-down') {
      await this.scaleDown(decision.zone, decision.targetCount)
    }

    this.lastScalingAction = new Date()
  }

  /**
   * Scale up agents in a zone
   */
  private async scaleUp(zone: Agent['zone'], targetCount: number): Promise<void> {
    const currentCount = await this.registry.getAgentCount(zone)
    const toAdd = targetCount - currentCount

    console.log(`[AutoScaler] Adding ${toAdd} agents to ${zone}`)

    // TODO: Trigger deployment of new agents
    // This would call Railway API, Cloudflare Workers API, etc.

    // For now, just log
    console.log(`[AutoScaler] Would deploy ${toAdd} agents to ${zone}`)
  }

  /**
   * Scale down agents in a zone
   */
  private async scaleDown(zone: Agent['zone'], targetCount: number): Promise<void> {
    const currentCount = await this.registry.getAgentCount(zone)
    const toRemove = currentCount - targetCount

    console.log(`[AutoScaler] Removing ${toRemove} agents from ${zone}`)

    // Get least-utilized agents
    const agents = await this.registry.listAgents({ zone, status: 'active' })
    agents.sort((a, b) => a.tasksCompleted - b.tasksCompleted) // Sort by least tasks

    const agentsToRemove = agents.slice(0, toRemove)

    for (const agent of agentsToRemove) {
      await this.registry.updateAgentStatus(agent.id, 'paused')
      console.log(`[AutoScaler] Paused agent ${agent.id}`)
    }
  }

  /**
   * Run auto-scaling cycle
   */
  async runScalingCycle(): Promise<{
    metrics: ScalingMetrics
    decision: ScalingDecision
    executed: boolean
  }> {
    console.log('[AutoScaler] Running scaling cycle...')

    const metrics = await this.getMetrics()
    const decision = await this.makeDecision(metrics)

    console.log(`[AutoScaler] Metrics:`, metrics)
    console.log(`[AutoScaler] Decision: ${decision.action} (${decision.reason})`)

    if (decision.action !== 'none') {
      await this.executeScaling(decision)
    }

    return {
      metrics,
      decision,
      executed: decision.action !== 'none',
    }
  }
}
