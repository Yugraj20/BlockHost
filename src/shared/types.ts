export type ServerSoftware =
  | 'vanilla'
  | 'paper'
  | 'purpur'
  | 'fabric'
  | 'quilt'
  | 'forge'
  | 'neoforge'

export type ServerStatus = 'offline' | 'starting' | 'online' | 'stopping' | 'crashed' | 'installing'

export interface ServerConfig {
  id: string
  name: string
  software: ServerSoftware
  version: string
  build?: string
  port: number
  ramMb: number
  minRamMb: number
  javaPath: string // 'auto' or explicit path
  jvmArgs: string
  aikarFlags: boolean
  jarFile: string
  directory: string
  thumbnail: string // bg-1 .. bg-16
  maxPlayers: number
  motd: string
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator'
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'
  onlineMode: boolean
  pvp: boolean
  whitelistEnabled: boolean
  levelName: string
  autoStart: boolean
  autoRestartOnCrash: boolean
  autoRestartMaxRetries: number
  autoRestartRamLimitPercent: number // 0 = disabled
  autoRestartScheduleCron: string // '' = disabled
  playitTunnelId?: string
  playitPublicAddress?: string
  createdAt: number
  lastStartedAt?: number
}

export interface ServerRuntimeState {
  id: string
  status: ServerStatus
  pid?: number
  cpuPercent: number
  ramUsedMb: number
  ramTotalMb: number
  tps: number
  uptimeSeconds: number
  playersOnline: PlayerEntry[]
  crashLoopCount: number
  lastCrashReport?: string
  history: {
    timestamp: number
    cpu: number
    ramMb: number
    players: number
    tps: number
  }[]
}

export interface PlayerEntry {
  name: string
  uuid: string
  joinedAt?: number
  ip?: string
  isOp?: boolean
  opLevel?: number
  whitelisted?: boolean
}

export interface BanEntry {
  uuid?: string
  name?: string
  ip?: string
  created: string
  source: string
  expires: string
  reason: string
}

export interface OpEntry {
  uuid: string
  name: string
  level: number
  bypassesPlayerLimit: boolean
}

export interface WhitelistEntry {
  uuid: string
  name: string
}

export interface JavaInstallation {
  version: string
  majorVersion: number
  vendor: string
  path: string
  arch: string
  managed: boolean
}

export interface ModrinthProject {
  project_id: string
  project_type: 'mod' | 'plugin' | 'modpack' | 'datapack'
  slug: string
  title: string
  description: string
  categories: string[]
  client_side: string
  server_side: string
  downloads: number
  icon_url: string
  author: string
  versions: string[]
  follows: number
  date_modified: string
  latest_version?: string
}

export interface ModrinthVersion {
  id: string
  project_id: string
  name: string
  version_number: string
  game_versions: string[]
  loaders: string[]
  files: {
    url: string
    filename: string
    primary: boolean
    size: number
    hashes: { sha1: string; sha512: string }
  }[]
  dependencies: {
    version_id?: string
    project_id?: string
    dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded'
  }[]
}

export interface InstalledAddon {
  filename: string
  name: string
  version: string
  type: 'mod' | 'plugin' | 'datapack'
  enabled: boolean
  size: number
  projectId?: string
  versionId?: string
  author?: string
  description?: string
  updateAvailable?: ModrinthVersion
}

export interface FileNode {
  name: string
  path: string // relative to server root
  isDirectory: boolean
  size: number
  modifiedAt: number
  extension: string
}

export interface WorldInfo {
  name: string
  folderName: string
  dimension: 'overworld' | 'nether' | 'the_end' | 'custom'
  sizeBytes: number
  isActive: boolean
  seed?: string
  lastPlayed?: number
}

export interface BackupEntry {
  id: string
  serverId: string
  serverName: string
  name: string
  filename: string
  filePath: string
  sizeBytes: number
  createdAt: number
  scope: 'full' | 'world'
  note?: string
}

export interface ScheduleTask {
  id: string
  serverId: string
  name: string
  cron: string
  action: 'backup' | 'restart' | 'command' | 'broadcast'
  payload: string
  enabled: boolean
  lastRunAt?: number
  nextRunAt?: string
}

export interface CommandMacro {
  id: string
  label: string
  command: string
  icon?: string
  color?: string
}

export interface PlayitTunnel {
  id: string
  internalId?: number
  serverId: string
  name: string
  proto: 'tcp' | 'udp' | 'both'
  localIp?: string
  localPort: number
  publicAddress: string
  publicPort: number
  status: 'active' | 'connecting' | 'paused' | 'error'
  activeConnections: number
  bytesIn: number
  bytesOut: number
  latencyMs: number
}

export interface PlayitState {
  linked: boolean
  agentId?: string
  accountEmail?: string
  claimCode?: string
  claimUrl?: string
  controlChannelStatus: 'disconnected' | 'claiming' | 'connected' | 'reconnecting' | 'error'
  controlServerAddress?: string
  lastError?: string
  protocolVersion: string
  tunnels: PlayitTunnel[]
}

export interface SystemMetrics {
  cpuPercent: number
  cpuModel: string
  cpuCores: number
  ramUsedBytes: number
  ramTotalBytes: number
  diskUsedBytes: number
  diskTotalBytes: number
  lanIps: string[]
  publicIp?: string
  uptimeSeconds: number
}

export interface ActivityEvent {
  id: string
  timestamp: number
  serverId?: string
  serverName?: string
  type: 'player_join' | 'player_leave' | 'server_start' | 'server_stop' | 'server_crash' | 'backup' | 'mod_install' | 'tunnel' | 'system'
  title: string
  subtitle: string
}

export interface NotificationItem {
  id: string
  timestamp: number
  title: string
  body: string
  level: 'info' | 'success' | 'warning' | 'error'
  read: boolean
}

export interface DownloadTask {
  id: string
  title: string
  url: string
  destPath: string
  totalBytes: number
  downloadedBytes: number
  status: 'queued' | 'downloading' | 'verifying' | 'completed' | 'failed'
  sha256?: string
  error?: string
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  accentColor: 'indigo' | 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose'
  backgroundArt: string // 'bg-1' .. 'bg-16' or 'none'
  fontScale: 'sm' | 'md' | 'lg'
  reducedMotion: boolean
  highContrast: boolean
  minimizeToTray: boolean
  launchOnStartup: boolean
  serversDir: string
  backupsDir: string
  javaDir: string
  maxBackupsPerServer: number
  notificationsEnabled: boolean
  desktopToastsEnabled: boolean
  notifyOnCrash: boolean
  notifyOnBackup: boolean
  notifyOnPlayerJoin: boolean
  pinEnabled: boolean
  pinHash: string
  autoUpdateChannel: 'latest' | 'beta'
  updateFeedOwner: string
  updateFeedRepo: string
  commandMacros: CommandMacro[]
}

export interface DiagnosticsReport {
  generatedAt: string
  appVersion: string
  electronVersion: string
  nodeVersion: string
  platform: string
  osRelease: string
  cpuModel: string
  cpuCores: number
  totalRamGb: number
  freeRamGb: number
  disks: { mount: string; totalGb: number; freeGb: number }[]
  javaInstallations: JavaInstallation[]
  lanIps: string[]
  serversCount: number
  runningServersCount: number
  playitStatus: string
  selfTests: {
    name: string
    passed: boolean
    detail: string
  }[]
}
