import fs from 'fs'
import path from 'path'
import { BackupEntry } from '../../shared/types'
import { ConfigService } from './ConfigService'
import { ServerManager } from './ServerManager'
import { ZipService } from './ZipService'
import { NotificationService } from './NotificationService'

export class BackupService {
  constructor(
    private config: ConfigService,
    private serverManager: ServerManager,
    private notifier: NotificationService
  ) {}

  /**
   * Create a full or world-only backup ZIP.
   * When the server is online, sends `save-off` + `save-all flush` before archiving and `save-on` after.
   */
  public async createBackup(options: {
    serverId: string
    name?: string
    scope: 'full' | 'world'
    note?: string
  }): Promise<BackupEntry> {
    const srv = this.config.getServer(options.serverId)
    if (!srv) throw new Error('Server not found')

    const state = this.serverManager.getRuntimeState(srv.id)
    const isOnline = state.status === 'online'

    if (isOnline) {
      this.serverManager.sendCommand(srv.id, 'save-off')
      this.serverManager.sendCommand(srv.id, 'save-all flush')
      await new Promise((r) => setTimeout(r, 1200))
    }

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const safeName = srv.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      const filename = `${safeName}-${options.scope}-${stamp}.zip`
      const serverBackupFolder = path.join(this.config.getSettings().backupsDir, srv.id)
      fs.mkdirSync(serverBackupFolder, { recursive: true })
      const destZip = path.join(serverBackupFolder, filename)

      let subPaths: string[] | undefined
      if (options.scope === 'world') {
        const candidates = [srv.levelName, `${srv.levelName}_nether`, `${srv.levelName}_the_end`]
        subPaths = candidates.filter((c) => fs.existsSync(path.join(srv.directory, c)))
      }

      const sizeBytes = await ZipService.createZip(srv.directory, destZip, subPaths)

      const entry: BackupEntry = {
        id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        serverId: srv.id,
        serverName: srv.name,
        name: options.name || `${srv.name} (${options.scope === 'full' ? 'Full Backup' : 'World Backup'})`,
        filename,
        filePath: destZip,
        sizeBytes,
        createdAt: Date.now(),
        scope: options.scope,
        note: options.note
      }

      this.config.addBackup(entry)
      this.enforceRetentionPolicy(srv.id)

      this.config.addActivity({
        serverId: srv.id,
        serverName: srv.name,
        type: 'backup',
        title: `Backup created for ${srv.name}`,
        subtitle: `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB (${options.scope})`
      })

      this.notifier.notify({
        title: `Backup Completed: ${srv.name}`,
        body: `Saved ${filename} (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB)`,
        level: 'success',
        category: 'backup'
      })

      return entry
    } finally {
      if (isOnline) {
        this.serverManager.sendCommand(srv.id, 'save-on')
      }
    }
  }

  private enforceRetentionPolicy(serverId: string): void {
    const max = this.config.getSettings().maxBackupsPerServer || 10
    const list = this.config.getBackups(serverId)
    if (list.length <= max) return

    const excess = list.slice(max)
    for (const old of excess) {
      try {
        if (fs.existsSync(old.filePath)) fs.unlinkSync(old.filePath)
      } catch {
        // ignore
      }
      this.config.removeBackup(old.id)
    }
  }

  /**
   * Restore a backup into the server folder.
   * Stops the server if running and creates a pre-restore safety snapshot first.
   */
  public async restoreBackup(backupId: string, createSafetyBackup = true): Promise<void> {
    const entry = this.config.getBackups().find((b) => b.id === backupId)
    if (!entry) throw new Error('Backup entry not found')
    if (!fs.existsSync(entry.filePath)) throw new Error('Backup ZIP file is missing on disk')

    const srv = this.config.getServer(entry.serverId)
    if (!srv) throw new Error('Target server no longer exists')

    const state = this.serverManager.getRuntimeState(srv.id)
    if (state.status !== 'offline') {
      await this.serverManager.stopServer(srv.id)
    }

    if (createSafetyBackup && fs.existsSync(srv.directory)) {
      await this.createBackup({
        serverId: srv.id,
        name: `Pre-Restore Safety Snapshot`,
        scope: entry.scope,
        note: `Created automatically before restoring ${entry.name}`
      })
    }

    if (entry.scope === 'world') {
      for (const dim of [srv.levelName, `${srv.levelName}_nether`, `${srv.levelName}_the_end`]) {
        const dimDir = path.join(srv.directory, dim)
        if (fs.existsSync(dimDir)) {
          fs.rmSync(dimDir, { recursive: true, force: true })
        }
      }
    }

    await ZipService.extractZip(entry.filePath, srv.directory)

    this.config.addActivity({
      serverId: srv.id,
      serverName: srv.name,
      type: 'backup',
      title: `Restored backup on ${srv.name}`,
      subtitle: entry.name
    })
  }

  public deleteBackup(backupId: string): void {
    const entry = this.config.getBackups().find((b) => b.id === backupId)
    if (entry && fs.existsSync(entry.filePath)) {
      try {
        fs.unlinkSync(entry.filePath)
      } catch {
        // ignore
      }
    }
    this.config.removeBackup(backupId)
  }
}
