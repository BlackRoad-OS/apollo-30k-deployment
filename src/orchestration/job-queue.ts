/**
 * Job Queue Orchestration - BullMQ system for distributing jobs to 30k agents
 * Handles job creation, routing, processing, and monitoring
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq'
import { Redis } from 'ioredis'
import { z } from 'zod'
import type { Agent } from '../registry/agent-registry.js'

// Job schema
export const JobSchema = z.object({
  type: z.enum([
    'task-execution',
    'model-inference',
    'data-processing',
    'monitoring',
    'coordination',
  ]),
  agentId: z.string().optional(),
  zone: z.enum(['railway', 'cloudflare', 'digitalocean', 'pi']).optional(),
  priority: z.number().min(1).max(10).default(5),
  input: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
})

export type JobData = z.infer<typeof JobSchema>

// Job result schema
export const JobResultSchema = z.object({
  success: z.boolean(),
  output: z.any().optional(),
  error: z.string().optional(),
  executionTime: z.number(), // milliseconds
  agentId: z.string(),
})

export type JobResult = z.infer<typeof JobResultSchema>

// Queue configuration
const QUEUE_CONFIG = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
}

// Worker configuration per zone
const WORKER_CONFIG = {
  railway: {
    concurrency: 100,
    limiter: {
      max: 1000,
      duration: 1000, // 1000 jobs/second
    },
  },
  cloudflare: {
    concurrency: 50,
    limiter: {
      max: 500,
      duration: 1000,
    },
  },
  digitalocean: {
    concurrency: 20,
    limiter: {
      max: 200,
      duration: 1000,
    },
  },
  pi: {
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000,
    },
  },
}

/**
 * Job Queue Manager - Creates and manages queues per zone
 */
export class JobQueueManager {
  private queues: Map<string, Queue> = new Map()
  private workers: Map<string, Worker> = new Map()
  private events: Map<string, QueueEvents> = new Map()

  constructor(private redis: Redis) {}

  /**
   * Create a queue for a specific zone
   */
  createQueue(zone: Agent['zone']): Queue {
    const queueName = `agents-${zone}`

    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!
    }

    const queue = new Queue(queueName, {
      connection: this.redis,
      ...QUEUE_CONFIG,
    })

    this.queues.set(queueName, queue)
    return queue
  }

  /**
   * Create a worker for a specific zone
   */
  createWorker(
    zone: Agent['zone'],
    processor: (job: Job<JobData>) => Promise<JobResult>
  ): Worker {
    const queueName = `agents-${zone}`

    if (this.workers.has(queueName)) {
      return this.workers.get(queueName)!
    }

    const worker = new Worker(queueName, processor, {
      connection: this.redis,
      ...WORKER_CONFIG[zone],
    })

    // Worker event handlers
    worker.on('completed', (job: Job, result: JobResult) => {
      console.log(`[${zone}] Job ${job.id} completed by agent ${result.agentId}`)
    })

    worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`[${zone}] Job ${job?.id} failed:`, err.message)
    })

    worker.on('error', (err: Error) => {
      console.error(`[${zone}] Worker error:`, err)
    })

    this.workers.set(queueName, worker)
    return worker
  }

  /**
   * Create queue events listener for monitoring
   */
  createQueueEvents(zone: Agent['zone']): QueueEvents {
    const queueName = `agents-${zone}`

    if (this.events.has(queueName)) {
      return this.events.get(queueName)!
    }

    const events = new QueueEvents(queueName, {
      connection: this.redis,
    })

    this.events.set(queueName, events)
    return events
  }

  /**
   * Add a job to the queue
   */
  async addJob(zone: Agent['zone'], data: JobData): Promise<Job<JobData>> {
    const queue = this.createQueue(zone)
    return queue.add(data.type, data, {
      priority: data.priority,
    })
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(zone: Agent['zone']) {
    const queue = this.createQueue(zone)

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])

    return {
      zone,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    }
  }

  /**
   * Get metrics for all zones
   */
  async getAllMetrics() {
    const zones: Agent['zone'][] = ['railway', 'cloudflare', 'digitalocean', 'pi']
    const metrics = await Promise.all(zones.map((zone) => this.getQueueMetrics(zone)))

    return {
      zones: metrics,
      total: metrics.reduce((acc, m) => ({
        waiting: acc.waiting + m.waiting,
        active: acc.active + m.active,
        completed: acc.completed + m.completed,
        failed: acc.failed + m.failed,
        delayed: acc.delayed + m.delayed,
        total: acc.total + m.total,
      }), {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
      }),
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(zone: Agent['zone'], grace: number = 86400000): Promise<void> {
    const queue = this.createQueue(zone)
    await queue.clean(grace, 1000, 'completed')
    await queue.clean(grace, 1000, 'failed')
  }

  /**
   * Pause a queue
   */
  async pauseQueue(zone: Agent['zone']): Promise<void> {
    const queue = this.createQueue(zone)
    await queue.pause()
  }

  /**
   * Resume a queue
   */
  async resumeQueue(zone: Agent['zone']): Promise<void> {
    const queue = this.createQueue(zone)
    await queue.resume()
  }

  /**
   * Shutdown all queues and workers
   */
  async shutdown(): Promise<void> {
    // Close all workers
    await Promise.all(
      Array.from(this.workers.values()).map((worker) => worker.close())
    )

    // Close all queue events
    await Promise.all(
      Array.from(this.events.values()).map((events) => events.close())
    )

    // Close all queues
    await Promise.all(
      Array.from(this.queues.values()).map((queue) => queue.close())
    )

    // Close Redis connection
    this.redis.disconnect()
  }
}

/**
 * Create default job processor
 */
export function createJobProcessor(
  onProcess: (job: Job<JobData>) => Promise<JobResult>
) {
  return async (job: Job<JobData>): Promise<JobResult> => {
    const startTime = Date.now()

    try {
      const result = await onProcess(job)
      const executionTime = Date.now() - startTime

      return {
        ...result,
        executionTime,
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      throw {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        agentId: job.data.agentId || 'unknown',
      }
    }
  }
}
