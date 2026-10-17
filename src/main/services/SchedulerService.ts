import cron from 'node-cron'
import { ScheduleTask } from '../../shared/types'
import { ConfigService } from './ConfigService'
import { ServerManager } from './ServerManager'
import { BackupService } from './BackupService'
import { logger } from '../utils/logger'

export class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map()

  constructor(
    private config: ConfigService,
    private serverManager: ServerManager,
    private backupService: BackupService
  ) {
    this.reloadAll()
  }

  public reloadAll(): void {
    for (const job of this.jobs.values()) {
      job.stop()
    }
    this.jobs.clear()

    for (const task of this.config.getSchedules()) {
      if (task.enabled) {
        this.registerJob(task)
      }
    }
  }

  private registerJob(task: ScheduleTask): void {
    if (!cron.validate(task.cron)) {
      logger.warn(`Invalid cron expression for task ${task.name}: ${task.cron}`)
      return
    }

    const job = cron.schedule(task.cron, async () => {
      await this.executeTask(task.id)
    })
    this.jobs.set(task.id, job)
  }

  public async executeTask(taskId: string): Promise<void> {
    const task = this.config.getSchedules().find((t) => t.id === taskId)
    if (!task) return

    task.lastRunAt = Date.now()
    this.config.upsertSchedule(task)

    try {
      switch (task.action) {
        case 'backup':
          await this.backupService.createBackup({
            serverId: task.serverId,
            name: `Scheduled: ${task.name}`,
            scope: task.payload === 'world' ? 'world' : 'full'
          })
          break
        case 'restart':
          await this.serverManager.restartServer(task.serverId)
          break
        case 'command':
          this.serverManager.sendCommand(task.serverId, task.payload || 'list')
          break
        case 'broadcast':
          this.serverManager.sendCommand(task.serverId, `say [Broadcast] ${task.payload}`)
          break
      }
    } catch (err) {
      logger.error(`Scheduled task "${task.name}" failed`, err)
    }
  }

  public createOrUpdateSchedule(input: Omit<ScheduleTask, 'id'> & { id?: string }): ScheduleTask {
    if (!cron.validate(input.cron)) {
      throw new Error(`Invalid cron expression: "${input.cron}"`)
    }
    const task: ScheduleTask = {
      ...input,
      id: input.id || `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    }
    this.config.upsertSchedule(task)
    this.reloadAll()
    return task
  }

  public deleteSchedule(id: string): void {
    this.jobs.get(id)?.stop()
    this.jobs.delete(id)
    this.config.removeSchedule(id)
  }
}
