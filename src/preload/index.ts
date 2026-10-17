import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Window
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // Bootstrap
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),

  // Servers
  listServers: () => ipcRenderer.invoke('servers:list'),
  createServer: (input: unknown) => ipcRenderer.invoke('servers:create', input),
  importServer: (sourcePath: string, customName?: string) =>
    ipcRenderer.invoke('servers:import', { sourcePath, customName }),
  updateServer: (server: unknown) => ipcRenderer.invoke('servers:update', server),
  deleteServer: (serverId: string) => ipcRenderer.invoke('servers:delete', serverId),
  startServer: (serverId: string) => ipcRenderer.invoke('servers:start', serverId),
  stopServer: (serverId: string) => ipcRenderer.invoke('servers:stop', serverId),
  restartServer: (serverId: string) => ipcRenderer.invoke('servers:restart', serverId),
  sendCommand: (serverId: string, command: string) =>
    ipcRenderer.invoke('servers:command', { serverId, command }),
  getConsoleLines: (serverId: string) => ipcRenderer.invoke('servers:consoleLines', serverId),
  clearConsole: (serverId: string) => ipcRenderer.invoke('servers:clearConsole', serverId),
  checkPort: (port: number) => ipcRenderer.invoke('servers:checkPort', port),
  nextFreePort: (startPort?: number) => ipcRenderer.invoke('servers:nextFreePort', startPort),
  reinstallJar: (serverId: string) => ipcRenderer.invoke('servers:reinstallJar', serverId),

  // Providers
  getProviderVersions: (software: string) => ipcRenderer.invoke('providers:versions', software),

  // Server Properties
  getServerProperties: (serverId: string) => ipcRenderer.invoke('properties:get', serverId),
  saveServerProperties: (serverId: string, props: Record<string, string>) =>
    ipcRenderer.invoke('properties:save', { serverId, props }),

  // Players
  getPlayersData: (serverId: string) => ipcRenderer.invoke('players:getAll', serverId),
  addWhitelist: (serverId: string, name: string) =>
    ipcRenderer.invoke('players:whitelistAdd', { serverId, name }),
  removeWhitelist: (serverId: string, name: string) =>
    ipcRenderer.invoke('players:whitelistRemove', { serverId, name }),
  addOp: (serverId: string, name: string, level: number) =>
    ipcRenderer.invoke('players:opAdd', { serverId, name, level }),
  removeOp: (serverId: string, name: string) =>
    ipcRenderer.invoke('players:opRemove', { serverId, name }),
  addBan: (serverId: string, target: string, reason: string, isIp: boolean) =>
    ipcRenderer.invoke('players:banAdd', { serverId, target, reason, isIp }),
  removeBan: (serverId: string, target: string, isIp: boolean) =>
    ipcRenderer.invoke('players:banRemove', { serverId, target, isIp }),

  // Java
  detectJava: () => ipcRenderer.invoke('java:detect'),
  installTemurin: (major: 8 | 17 | 21 | 25) => ipcRenderer.invoke('java:installTemurin', major),

  // Modrinth & Addons
  searchModrinth: (params: unknown) => ipcRenderer.invoke('modrinth:search', params),
  getModrinthVersions: (projectId: string, gameVersion?: string, loader?: string) =>
    ipcRenderer.invoke('modrinth:versions', { projectId, gameVersion, loader }),
  installAddon: (options: unknown) => ipcRenderer.invoke('modrinth:installAddon', options),
  installModpack: (options: unknown) => ipcRenderer.invoke('modrinth:installModpack', options),
  listAddons: (serverId: string) => ipcRenderer.invoke('addons:list', serverId),
  toggleAddon: (serverId: string, filename: string, type: 'mod' | 'plugin' | 'datapack') =>
    ipcRenderer.invoke('addons:toggle', { serverId, filename, type }),
  deleteAddon: (serverId: string, filename: string, type: 'mod' | 'plugin' | 'datapack') =>
    ipcRenderer.invoke('addons:delete', { serverId, filename, type }),
  checkAddonUpdates: (serverId: string) => ipcRenderer.invoke('addons:checkUpdates', serverId),

  // Files, Logs, Worlds
  listFiles: (serverId: string, relDir = '') =>
    ipcRenderer.invoke('files:list', { serverId, relDir }),
  readFile: (serverId: string, relPath: string) =>
    ipcRenderer.invoke('files:read', { serverId, relPath }),
  writeFile: (serverId: string, relPath: string, content: string) =>
    ipcRenderer.invoke('files:write', { serverId, relPath, content }),
  createDirectory: (serverId: string, relPath: string) =>
    ipcRenderer.invoke('files:mkdir', { serverId, relPath }),
  renameEntry: (serverId: string, oldRelPath: string, newName: string) =>
    ipcRenderer.invoke('files:rename', { serverId, oldRelPath, newName }),
  deleteEntry: (serverId: string, relPath: string) =>
    ipcRenderer.invoke('files:delete', { serverId, relPath }),
  uploadFilesDialog: (serverId: string, destRelDir = '') =>
    ipcRenderer.invoke('files:uploadDialog', { serverId, destRelDir }),
  extractZip: (serverId: string, relZipPath: string, relTargetDir = '') =>
    ipcRenderer.invoke('files:extractZip', { serverId, relZipPath, relTargetDir }),
  compressZip: (serverId: string, relPaths: string[], outputRelZipPath: string) =>
    ipcRenderer.invoke('files:compressZip', { serverId, relPaths, outputRelZipPath }),
  listLogs: (serverId: string) => ipcRenderer.invoke('logs:list', serverId),
  listWorlds: (serverId: string) => ipcRenderer.invoke('worlds:list', serverId),
  resetWorld: (serverId: string, folderName: string) =>
    ipcRenderer.invoke('worlds:reset', { serverId, folderName }),
  exportWorld: (serverId: string, folderName: string) =>
    ipcRenderer.invoke('worlds:export', { serverId, folderName }),
  importWorld: (serverId: string, folderName: string) =>
    ipcRenderer.invoke('worlds:import', { serverId, folderName }),

  // Backups
  listBackups: (serverId?: string) => ipcRenderer.invoke('backups:list', serverId),
  createBackup: (options: unknown) => ipcRenderer.invoke('backups:create', options),
  restoreBackup: (backupId: string, createSafetyBackup = true) =>
    ipcRenderer.invoke('backups:restore', { backupId, createSafetyBackup }),
  deleteBackup: (backupId: string) => ipcRenderer.invoke('backups:delete', backupId),

  // Schedules
  listSchedules: (serverId?: string) => ipcRenderer.invoke('schedules:list', serverId),
  saveSchedule: (task: unknown) => ipcRenderer.invoke('schedules:save', task),
  runScheduleNow: (taskId: string) => ipcRenderer.invoke('schedules:runNow', taskId),
  deleteSchedule: (taskId: string) => ipcRenderer.invoke('schedules:delete', taskId),

  // playit.gg & Network
  getPlayitState: () => ipcRenderer.invoke('playit:getState'),
  startPlayitClaim: (openBrowser = true) => ipcRenderer.invoke('playit:startClaim', openBrowser),
  linkPlayitKey: (secretKey?: string) => ipcRenderer.invoke('playit:linkKey', secretKey),
  unlinkPlayit: () => ipcRenderer.invoke('playit:unlink'),
  createPlayitTunnel: (serverId: string, proto: 'tcp' | 'udp' | 'both' = 'tcp') =>
    ipcRenderer.invoke('playit:createTunnel', { serverId, proto }),
  togglePlayitTunnel: (tunnelId: string) => ipcRenderer.invoke('playit:toggleTunnel', tunnelId),
  deletePlayitTunnel: (tunnelId: string) => ipcRenderer.invoke('playit:deleteTunnel', tunnelId),
  allowFirewallPort: (port: number, ruleName?: string) =>
    ipcRenderer.invoke('network:firewallAllow', { port, ruleName }),
  getPublicIp: () => ipcRenderer.invoke('network:publicIp'),

  // System & Settings
  getSystemMetrics: () => ipcRenderer.invoke('system:metrics'),
  getDiagnostics: () => ipcRenderer.invoke('system:diagnostics'),
  getAppLogs: () => ipcRenderer.invoke('system:appLogs'),
  getStorageStats: () => ipcRenderer.invoke('system:storageStats'),
  clearCache: () => ipcRenderer.invoke('system:clearCache'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: unknown) => ipcRenderer.invoke('settings:update', partial),
  setSecurityPin: (plainPin: string) => ipcRenderer.invoke('security:setPin', plainPin),
  verifySecurityPin: (plainPin: string) => ipcRenderer.invoke('security:verifyPin', plainPin),

  // Notifications & Activities
  markNotificationsRead: () => ipcRenderer.invoke('notifications:markRead'),
  clearNotifications: () => ipcRenderer.invoke('notifications:clear'),
  listActivities: () => ipcRenderer.invoke('activities:list'),

  // Dialogs & Shell
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  pickImportTarget: () => ipcRenderer.invoke('dialog:pickImportTarget'),
  openPath: (targetPath: string) => ipcRenderer.invoke('shell:openPath', targetPath),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),

  // Event Subscriptions
  onEvent: (channel: string, listener: (payload: any) => void) => {
    const subscription = (_event: unknown, data: any) => listener(data)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
export type BlockHostApi = typeof api
