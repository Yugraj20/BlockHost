import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import {
  AppSettings,
  ServerConfig,
  BackupEntry,
  ScheduleTask,
  ActivityEvent,
  NotificationItem
} from '../../shared/types'
import { logger } from '../utils/logger'

interface PersistedDatabase {
  settings: AppSettings
  servers: ServerConfig[]
  backups: BackupEntry[]
  schedules: ScheduleTask[]
  activities: ActivityEvent[]
  notifications: NotificationItem[]
  playitSecretKeyEncrypted?: string
  playitAgentId?: string
}

export class ConfigService {
  private baseDir: string
  private configFile: string
  private data: PersistedDatabase

  constructor() {
    const rootAppData = app?.isReady?.()
      ? app.getPath('appData')
      : (process.env.APPDATA || path.resolve('.'))
    const legacyDir = path.join(rootAppData, 'BlockHost')
    const primaryDir = path.join(rootAppData, 'VoxelPulse')

    // If legacy BlockHost directory exists and new VoxelPulse dir does not, keep existing user data seamlessly
    if (fs.existsSync(legacyDir) && !fs.existsSync(primaryDir)) {
      this.baseDir = legacyDir
    } else {
      this.baseDir = primaryDir
    }

    fs.mkdirSync(this.baseDir, { recursive: true })
    this.configFile = path.join(this.baseDir, 'config.json')
    this.data = this.load()
    this.ensureDirectories()
  }

  private defaultSettings(): AppSettings {
    return {
      theme: 'dark',
      accentColor: 'indigo',
      backgroundArt: 'bg-3',
      fontScale: 'md',
      reducedMotion: false,
      highContrast: false,
      minimizeToTray: true,
      launchOnStartup: false,
      serversDir: path.join(this.baseDir, 'servers'),
      backupsDir: path.join(this.baseDir, 'backups'),
      javaDir: path.join(this.baseDir, 'java'),
      maxBackupsPerServer: 10,
      notificationsEnabled: true,
      desktopToastsEnabled: true,
      notifyOnCrash: true,
      notifyOnBackup: true,
      notifyOnPlayerJoin: false,
      pinEnabled: false,
      pinHash: '',
      autoUpdateChannel: 'latest',
      updateFeedOwner: 'Yugraj20',
      updateFeedRepo: 'BlockHost',
      commandMacros: [
        { id: 'macro-day', label: 'Set Day', command: 'time set day', color: 'amber' },
        { id: 'macro-clear', label: 'Clear Weather', command: 'weather clear', color: 'cyan' },
        { id: 'macro-save', label: 'Save World', command: 'save-all flush', color: 'emerald' },
        { id: 'macro-list', label: 'List Players', command: 'list', color: 'violet' }
      ]
    }
  }

  private load(): PersistedDatabase {
    const defaults: PersistedDatabase = {
      settings: this.defaultSettings(),
      servers: [],
      backups: [],
      schedules: [],
      activities: [
        {
          id: 'act-init',
          timestamp: Date.now(),
          type: 'system',
          title: 'BlockHost initialized',
          subtitle: 'Ready to create or import Minecraft servers'
        }
      ],
      notifications: []
    }

    if (!fs.existsSync(this.configFile)) {
      fs.writeFileSync(this.configFile, JSON.stringify(defaults, null, 2), 'utf-8')
      return defaults
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.configFile, 'utf-8'))
      return {
        ...defaults,
        ...raw,
        settings: { ...defaults.settings, ...(raw.settings || {}) }
      }
    } catch (err) {
      logger.error('Failed to parse config.json, restoring defaults', err)
      return defaults
    }
  }

  public ensureDirectories(): void {
    fs.mkdirSync(this.data.settings.serversDir, { recursive: true })
    fs.mkdirSync(this.data.settings.backupsDir, { recursive: true })
    fs.mkdirSync(this.data.settings.javaDir, { recursive: true })
    fs.mkdirSync(path.join(this.baseDir, 'cache'), { recursive: true })
  }

  public save(): void {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      logger.error('Failed to save config.json', err)
    }
  }

  public getBaseDir(): string {
    return this.baseDir
  }

  public getCacheDir(): string {
    return path.join(this.baseDir, 'cache')
  }

  public getSettings(): AppSettings {
    return this.data.settings
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...partial }
    this.ensureDirectories()
    this.save()
    return this.data.settings
  }

  public getServers(): ServerConfig[] {
    return this.data.servers
  }

  public getServer(id: string): ServerConfig | undefined {
    return this.data.servers.find((s) => s.id === id)
  }

  public upsertServer(server: ServerConfig): ServerConfig {
    const idx = this.data.servers.findIndex((s) => s.id === server.id)
    if (idx >= 0) {
      this.data.servers[idx] = server
    } else {
      this.data.servers.push(server)
    }
    this.save()
    return server
  }

  public removeServer(id: string): void {
    this.data.servers = this.data.servers.filter((s) => s.id !== id)
    this.data.schedules = this.data.schedules.filter((s) => s.serverId !== id)
    this.save()
  }

  public getBackups(serverId?: string): BackupEntry[] {
    const list = serverId
      ? this.data.backups.filter((b) => b.serverId === serverId)
      : this.data.backups
    return [...list].sort((a, b) => b.createdAt - a.createdAt)
  }

  public addBackup(entry: BackupEntry): void {
    this.data.backups.unshift(entry)
    this.save()
  }

  public removeBackup(id: string): void {
    this.data.backups = this.data.backups.filter((b) => b.id !== id)
    this.save()
  }

  public getSchedules(serverId?: string): ScheduleTask[] {
    return serverId
      ? this.data.schedules.filter((s) => s.serverId === serverId)
      : this.data.schedules
  }

  public upsertSchedule(task: ScheduleTask): ScheduleTask {
    const idx = this.data.schedules.findIndex((t) => t.id === task.id)
    if (idx >= 0) {
      this.data.schedules[idx] = task
    } else {
      this.data.schedules.push(task)
    }
    this.save()
    return task
  }

  public removeSchedule(id: string): void {
    this.data.schedules = this.data.schedules.filter((t) => t.id !== id)
    this.save()
  }

  public addActivity(event: Omit<ActivityEvent, 'id' | 'timestamp'>): ActivityEvent {
    const full: ActivityEvent = {
      ...event,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now()
    }
    this.data.activities.unshift(full)
    this.data.activities = this.data.activities.slice(0, 100)
    this.save()
    return full
  }

  public getActivities(): ActivityEvent[] {
    return this.data.activities
  }

  public getNotifications(): NotificationItem[] {
    return this.data.notifications
  }

  public addNotification(item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): NotificationItem {
    const full: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      read: false
    }
    this.data.notifications.unshift(full)
    this.data.notifications = this.data.notifications.slice(0, 100)
    this.save()
    return full
  }

  public markNotificationsRead(): void {
    this.data.notifications.forEach((n) => (n.read = true))
    this.save()
  }

  public clearNotifications(): void {
    this.data.notifications = []
    this.save()
  }

  public getPlayitSecret(): { encrypted?: string; agentId?: string } {
    return {
      encrypted: this.data.playitSecretKeyEncrypted,
      agentId: this.data.playitAgentId
    }
  }

  public setPlayitSecret(encrypted?: string, agentId?: string): void {
    this.data.playitSecretKeyEncrypted = encrypted
    this.data.playitAgentId = agentId
    this.save()
  }
}
