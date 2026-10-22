import { create } from 'zustand'
import {
  AppSettings,
  ServerConfig,
  ServerRuntimeState,
  BackupEntry,
  ScheduleTask,
  ActivityEvent,
  NotificationItem,
  PlayitState,
  DownloadTask,
  SystemMetrics
} from '../../../shared/types'

export type NavTab =
  | 'home'
  | 'servers'
  | 'create'
  | 'modpacks'
  | 'addons'
  | 'files'
  | 'backups'
  | 'players'
  | 'network'
  | 'settings'
  | 'docs'

export type ServerSubTab =
  | 'console'
  | 'logs'
  | 'monitoring'
  | 'addons'
  | 'datapacks'
  | 'modpacks'
  | 'files'
  | 'players'
  | 'backups'
  | 'worlds'
  | 'properties'
  | 'jvm'
  | 'network'

interface AppStoreState {
  initialized: boolean
  locked: boolean
  activeTab: NavTab
  activeServerSubTab: ServerSubTab
  selectedServerId: string
  viewingServerId: string | null
  settings: AppSettings | null
  servers: ServerConfig[]
  runtimeStates: Record<string, ServerRuntimeState>
  consoleBuffers: Record<string, string[]>
  backups: BackupEntry[]
  schedules: ScheduleTask[]
  activities: ActivityEvent[]
  notifications: NotificationItem[]
  playit: PlayitState | null
  downloads: DownloadTask[]
  systemMetrics: SystemMetrics | null
  updater: {
    status: string
    version?: string
    releaseName?: string
    progressPercent?: number
    message?: string
    downloadUrl?: string
    releaseNotes?: string
    isForced?: boolean
  }

  setActiveTab: (tab: NavTab) => void
  setActiveServerSubTab: (sub: ServerSubTab) => void
  setSelectedServerId: (id: string) => void
  openServerDetail: (id: string, subTab?: ServerSubTab) => void
  closeServerDetail: () => void
  setLocked: (locked: boolean) => void
  loadBootstrap: () => Promise<void>
  refreshServers: () => Promise<void>
  refreshBackups: () => Promise<void>
  refreshSchedules: () => Promise<void>
  refreshActivities: () => Promise<void>
  refreshSystemMetrics: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  appendConsoleLine: (serverId: string, line: string) => void
  clearConsoleBuffer: (serverId: string) => void
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  initialized: false,
  locked: false,
  activeTab: 'home',
  activeServerSubTab: 'console',
  selectedServerId: '',
  viewingServerId: null,
  settings: null,
  servers: [],
  runtimeStates: {},
  consoleBuffers: {},
  backups: [],
  schedules: [],
  activities: [],
  notifications: [],
  playit: null,
  downloads: [],
  systemMetrics: null,
  updater: { status: 'idle' },

  setActiveTab: (tab) => {
    // If navigating to 'servers' from sidebar without viewingServerId, show directory
    set({ activeTab: tab })
  },
  setActiveServerSubTab: (sub) => set({ activeServerSubTab: sub }),
  setSelectedServerId: (id) => {
    set({ selectedServerId: id })
    window.api.getConsoleLines(id).then((lines) => {
      set((s) => ({
        consoleBuffers: { ...s.consoleBuffers, [id]: lines }
      }))
    })
  },
  openServerDetail: (id, subTab = 'console') => {
    set({
      selectedServerId: id,
      viewingServerId: id,
      activeTab: 'servers',
      activeServerSubTab: subTab
    })
    window.api.getConsoleLines(id).then((lines) => {
      set((s) => ({
        consoleBuffers: { ...s.consoleBuffers, [id]: lines }
      }))
    })
  },
  closeServerDetail: () => {
    set({ viewingServerId: null, activeTab: 'servers' })
  },
  setLocked: (locked) => set({ locked }),

  loadBootstrap: async () => {
    try {
      const data = await window.api.bootstrap()
      const firstId = data.servers[0]?.id || ''
      let initialLines: string[] = []
      if (firstId) {
        try {
          initialLines = await window.api.getConsoleLines(firstId)
        } catch {
          initialLines = []
        }
      }

      set({
        initialized: true,
        locked: Boolean(data.settings?.pinEnabled),
        settings: data.settings,
        servers: data.servers,
        selectedServerId: firstId,
        runtimeStates: data.runtimeStates,
        consoleBuffers: firstId ? { [firstId]: initialLines } : {},
        backups: data.backups,
        schedules: data.schedules,
        activities: data.activities,
        notifications: data.notifications,
        playit: data.playit,
        downloads: data.downloads,
        systemMetrics: data.systemMetrics,
        updater: data.updater
      })
    } catch (err) {
      console.error('Failed to bootstrap ChunkHarbor store:', err)
      set({ initialized: true })
    }
  },

  refreshServers: async () => {
    const servers = await window.api.listServers()
    const currentSelected = get().selectedServerId
    const nextSelected =
      servers.find((s: ServerConfig) => s.id === currentSelected)?.id || servers[0]?.id || ''
    set({ servers, selectedServerId: nextSelected })
    const activities = await window.api.listActivities()
    set({ activities })
  },

  refreshBackups: async () => {
    const backups = await window.api.listBackups()
    const activities = await window.api.listActivities()
    set({ backups, activities })
  },

  refreshSchedules: async () => {
    const schedules = await window.api.listSchedules()
    set({ schedules })
  },

  refreshActivities: async () => {
    const activities = await window.api.listActivities()
    set({ activities })
  },

  refreshSystemMetrics: async () => {
    const systemMetrics = await window.api.getSystemMetrics()
    set({ systemMetrics })
  },

  updateSettings: async (partial) => {
    const updated = await window.api.updateSettings(partial)
    set({ settings: updated })
  },

  appendConsoleLine: (serverId, line) => {
    set((s) => {
      const prev = s.consoleBuffers[serverId] || []
      const next = [...prev, line].slice(-1500)
      return {
        consoleBuffers: { ...s.consoleBuffers, [serverId]: next }
      }
    })
  },

  clearConsoleBuffer: (serverId) => {
    set((s) => ({
      consoleBuffers: { ...s.consoleBuffers, [serverId]: [] }
    }))
  }
}))
