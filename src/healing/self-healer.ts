/**
 * Self-Healing System - Automatic recovery from agent failures
 * < 1 minute recovery time for failed agents
 */

import type { Agent, AgentRegistryDB } from '../registry/agent-registry.js'

export interface HealingAction {
  agentId: string
  action: 'restart' | 'replace' | 'ignore'
  reason: string
  success: boolean
  executionTime: number
}

export interface HealingStats {
  totalHealed: number
  restarted: number
  replaced: number
  failed: number
  avgRecoveryTime: number
}

/**
 * Self-Healer - Automatically recovers failed agents
 */
export class SelfHealer {
  private restartCounts: Map<string, number> = new Map()
  private healingHistory: HealingAction[] = []
  private readonly MAX_RESTART_ATTEMPTS = 3

  constructor(private registry: AgentRegistryDB) {}

  /**
   * Get restart count for an agent
   */
  private getRestartCount(agentId: string): number {
    return this.restartCounts.get(agentId) || 0
  }

  /**
   * Increment restart count
   */
  private incrementRestartCount(agentId: string): void {
    const current = this.getRestartCount(agentId)
    this.restartCounts.set(agentId, current + 1)
  }

  /**
   * Reset restart count
   */
  private resetRestartCount(agentId: string): void {
    this.restartCounts.delete(agentId)
  }

  /**
   * Attempt to restart an agent
   */
  async restartAgent(agent: Agent): Promise<boolean> {
    console.log(`[SelfHealer] Attempting to restart agent ${agent.id}`)

    try {
      // Mark as paused during restart
      await this.registry.updateAgentStatus(agent.id, 'paused')

      // TODO: Trigger actual restart based on zone
      switch (agent.zone) {
        case 'railway':
          await this.restartRailwayAgent(agent)
          break
        case 'cloudflare':
          await this.restartCloudflareAgent(agent)
          break
        case 'digitalocean':
          await this.restartDigitalOceanAgent(agent)
          break
        case 'pi':
          await this.restartPiAgent(agent)
          break
      }

      // Mark as active after successful restart
      await this.registry.updateAgentStatus(agent.id, 'active')
      await this.registry.updateHeartbeat(agent.id)

      console.log(`[SelfHealer] Successfully restarted agent ${agent.id}`)
      return true
    } catch (error) {
      console.error(`[SelfHealer] Failed to restart agent ${agent.id}:`, error)
      return false
    }
  }

  /**
   * Restart Railway agent
   */
  private async restartRailwayAgent(agent: Agent): Promise<void> {
    // TODO: Call Railway API to restart service
    // For now, simulate restart
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log(`[SelfHealer] Restarted Railway agent ${agent.id}`)
  }

  /**
   * Restart Cloudflare Worker agent
   */
  private async restartCloudflareAgent(agent: Agent): Promise<void> {
    // Cloudflare Workers are stateless, just reset state
    await new Promise((resolve) => setTimeout(resolve, 500))
    console.log(`[SelfHealer] Reset Cloudflare agent ${agent.id}`)
  }

  /**
   * Restart DigitalOcean agent
   */
  private async restartDigitalOceanAgent(agent: Agent): Promise<void> {
    // TODO: SSH to DO droplet and restart container
    await new Promise((resolve) => setTimeout(resolve, 2000))
    console.log(`[SelfHealer] Restarted DigitalOcean agent ${agent.id}`)
  }

  /**
   * Restart Raspberry Pi agent
   */
  private async restartPiAgent(agent: Agent): Promise<void> {
    // TODO: SSH to Pi and restart container
    await new Promise((resolve) => setTimeout(resolve, 3000))
    console.log(`[SelfHealer] Restarted Pi agent ${agent.id}`)
  }

  /**
   * Spawn replacement agent
   */
  async spawnReplacementAgent(
    capability: string,
    zone: Agent['zone']
  ): Promise<Agent | null> {
    console.log(`[SelfHealer] Spawning replacement agent: ${capability} in ${zone}`)

    try {
      // Generate new agent ID
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 10)
      const newAgentId = `${capability}-${zone}-${random}`

      // Create replacement agent
      const newAgent: Omit<Agent, 'createdAt'> = {
        id: newAgentId,
        hash: `${timestamp}-${random}`, // TODO: Proper PS-SHA-∞ hash
        core: 'aria', // Default to aria
        capability,
        zone,
        status: 'active',
        healthScore: 100,
        lastHeartbeat: new Date(),
        tasksCompleted: 0,
        tasksFailed: 0,
        metadata: {
          replacementAgent: true,
        },
      }

      const registered = await this.registry.registerAgent(newAgent)
      console.log(`[SelfHealer] Spawned replacement agent ${registered.id}`)

      return registered
    } catch (error) {
      console.error(`[SelfHealer] Failed to spawn replacement:`, error)
      return null
    }
  }

  /**
   * Heal a single failed agent
   */
  async healAgent(agent: Agent): Promise<HealingAction> {
    const startTime = Date.now()
    const restartCount = this.getRestartCount(agent.id)

    // If agent has been restarted too many times, replace it
    if (restartCount >= this.MAX_RESTART_ATTEMPTS) {
      console.log(
        `[SelfHealer] Agent ${agent.id} exceeded restart limit, replacing...`
      )

      // Mark old agent as error
      await this.registry.updateAgentStatus(agent.id, 'error')

      // Spawn replacement
      const replacement = await this.spawnReplacementAgent(agent.capability, agent.zone)

      const action: HealingAction = {
        agentId: agent.id,
        action: 'replace',
        reason: `Exceeded ${this.MAX_RESTART_ATTEMPTS} restart attempts`,
        success: replacement !== null,
        executionTime: Date.now() - startTime,
      }

      this.healingHistory.push(action)
      this.resetRestartCount(agent.id)

      return action
    }

    // Attempt restart
    this.incrementRestartCount(agent.id)
    const success = await this.restartAgent(agent)

    const action: HealingAction = {
      agentId: agent.id,
      action: 'restart',
      reason: `Restart attempt ${restartCount + 1}/${this.MAX_RESTART_ATTEMPTS}`,
      success,
      executionTime: Date.now() - startTime,
    }

    this.healingHistory.push(action)

    // Reset restart count on success
    if (success) {
      this.resetRestartCount(agent.id)
    }

    return action
  }

  /**
   * Heal all failed agents
   */
  async healAllFailed(failedAgents: Agent[]): Promise<HealingAction[]> {
    console.log(`[SelfHealer] Healing ${failedAgents.length} failed agents...`)

    const actions = await Promise.all(
      failedAgents.map((agent) => this.healAgent(agent))
    )

    const successCount = actions.filter((a) => a.success).length
    console.log(`[SelfHealer] Healed ${successCount}/${failedAgents.length} agents`)

    return actions
  }

  /**
   * Get healing statistics
   */
  getStats(timePeriodMs: number = 3600000): HealingStats {
    const cutoff = Date.now() - timePeriodMs
    const recentActions = this.healingHistory.filter(
      (a) => Date.now() - a.executionTime < cutoff
    )

    const restarted = recentActions.filter((a) => a.action === 'restart' && a.success).length
    const replaced = recentActions.filter((a) => a.action === 'replace' && a.success).length
    const failed = recentActions.filter((a) => !a.success).length

    const avgRecoveryTime =
      recentActions.length > 0
        ? recentActions.reduce((sum, a) => sum + a.executionTime, 0) / recentActions.length
        : 0

    return {
      totalHealed: restarted + replaced,
      restarted,
      replaced,
      failed,
      avgRecoveryTime,
    }
  }

  /**
   * Run self-healing cycle
   */
  async runHealingCycle(staleAgents: Agent[]): Promise<{
    actions: HealingAction[]
    stats: HealingStats
  }> {
    console.log('[SelfHealer] Starting healing cycle...')

    const actions = await this.healAllFailed(staleAgents)
    const stats = this.getStats()

    console.log(`[SelfHealer] Healing cycle complete:`)
    console.log(`  - Restarted: ${stats.restarted}`)
    console.log(`  - Replaced: ${stats.replaced}`)
    console.log(`  - Failed: ${stats.failed}`)
    console.log(`  - Avg recovery time: ${stats.avgRecoveryTime.toFixed(0)}ms`)

    return { actions, stats }
  }

  /**
   * Clear old healing history
   */
  clearOldHistory(maxAgeMs: number = 86400000): void {
    const cutoff = Date.now() - maxAgeMs
    this.healingHistory = this.healingHistory.filter(
      (a) => Date.now() - a.executionTime < cutoff
    )
  }
}
