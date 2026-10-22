import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { ConfigService } from './services/ConfigService'
import { DownloadService } from './services/DownloadService'
import { JavaManager } from './services/JavaManager'
import { ServerProviderService } from './services/providers/ServerProviderService'
import { NotificationService } from './services/NotificationService'
import { ServerManager } from './services/ServerManager'
import { FileService } from './services/FileService'
import { ModrinthService } from './services/ModrinthService'
import { BackupService } from './services/BackupService'
import { SchedulerService } from './services/SchedulerService'
import { PlayitService } from './services/playit/PlayitService'
import { MonitorService } from './services/MonitorService'
import { TrayService } from './services/TrayService'
import { UpdaterService } from './services/UpdaterService'
import { getDirectorySize, hashPin, verifyPin } from './utils/security'
import { getAppLogTail, logger } from './utils/logger'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

const configService = new ConfigService()
const downloadService = new DownloadService()
const javaManager = new JavaManager(configService, downloadService)
const providerService = new ServerProviderService(downloadService)
const notificationService = new NotificationService(configService)
const serverManager = new ServerManager(
  configService,
  javaManager,
  providerService,
  notificationService
)
const fileService = new FileService(configService, serverManager)
const modrinthService = new ModrinthService(configService, downloadService)
const backupService = new BackupService(configService, serverManager, notificationService)
const schedulerService = new SchedulerService(configService, serverManager, backupService)
const playitService = new PlayitService(configService)
const monitorService = new MonitorService(
  configService,
  javaManager,
  serverManager,
  playitService
)
const updaterService = new UpdaterService(configService)
const trayService = new TrayService(
  configService,
  serverManager,
  () => mainWindow,
  () => {
    isQuitting = true
  }
)

function broadcast(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function wireServiceEvents(): void {
  serverManager.on('state:updated', (states) => broadcast('servers:stateUpdated', states))
  serverManager.on('console:line', (data) => broadcast('servers:consoleLine', data))
  serverManager.on('console:clear', (serverId) => broadcast('servers:consoleClear', serverId))
  downloadService.on('updated', (tasks) => broadcast('downloads:updated', tasks))
  notificationService.on('updated', (items) => broadcast('notifications:updated', items))
  playitService.on('updated', (state) => broadcast('playit:updated', state))
  updaterService.on('updated', (state) => broadcast('updater:updated', state))
}

function registerIpcHandlers(): void {
  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('window:close', () => {
    if (configService.getSettings().minimizeToTray && !isQuitting) {
      mainWindow?.hide()
    } else {
      isQuitting = true
      app.quit()
    }
  })
  ipcMain.handle('app:quit', () => {
    isQuitting = true
    app.quit()
  })

  // Initial bootstrap snapshot
  ipcMain.handle('app:bootstrap', async () => {
    return {
      settings: configService.getSettings(),
      servers: configService.getServers(),
      runtimeStates: serverManager.getAllRuntimeStates(),
      backups: configService.getBackups(),
      schedules: configService.getSchedules(),
      activities: configService.getActivities(),
      notifications: configService.getNotifications(),
      playit: playitService.getState(),
      downloads: downloadService.getTasks(),
      systemMetrics: await monitorService.getSystemMetrics(),
      updater: updaterService.getState()
    }
  })

  // Servers CRUD & lifecycle
  ipcMain.handle('servers:list', () => configService.getServers())
  ipcMain.handle('servers:create', (_, input) => serverManager.createServer(input))
  ipcMain.handle('servers:import', (_, { sourcePath, customName }) =>
    serverManager.importServer(sourcePath, customName)
  )
  ipcMain.handle('servers:update', (_, server) => {
    const updated = configService.upsertServer(server)
    serverManager.writeServerPropertiesSync(updated)
    serverManager.setupAutoRestartCron(updated)
    return updated
  })
  ipcMain.handle('servers:delete', (_, serverId: string) => serverManager.deleteServer(serverId))
  ipcMain.handle('servers:start', (_, serverId: string) => serverManager.startServer(serverId))
  ipcMain.handle('servers:stop', (_, serverId: string) => serverManager.stopServer(serverId))
  ipcMain.handle('servers:restart', (_, serverId: string) => serverManager.restartServer(serverId))
  ipcMain.handle('servers:command', (_, { serverId, command }) =>
    serverManager.sendCommand(serverId, command)
  )
  ipcMain.handle('servers:consoleLines', (_, serverId: string) =>
    serverManager.getConsoleLines(serverId)
  )
  ipcMain.handle('servers:clearConsole', (_, serverId: string) =>
    serverManager.clearConsoleLines(serverId)
  )
  ipcMain.handle('servers:checkPort', (_, port: number) => serverManager.isPortFree(port))
  ipcMain.handle('servers:nextFreePort', (_, startPort?: number) =>
    serverManager.findNextFreePort(startPort)
  )
  ipcMain.handle('servers:reinstallJar', async (_, serverId: string) => {
    const srv = configService.getServer(serverId)
    if (!srv) throw new Error('Server not found')
    const javaBin = await javaManager.resolveJavaForServer(srv.version, srv.javaPath)
    const res = await providerService.installServerJar({
      software: srv.software,
      version: srv.version,
      targetDir: srv.directory,
      javaBin
    })
    srv.jarFile = res.jarFile
    srv.build = res.build
    return configService.upsertServer(srv)
  })

  // Providers & Versions
  ipcMain.handle('providers:versions', (_, software) => providerService.getVersions(software))

  // Server Properties
  ipcMain.handle('properties:get', (_, serverId: string) => {
    const srv = configService.getServer(serverId)
    if (!srv) return {}
    return serverManager.readServerPropertiesMap(srv.directory)
  })
  ipcMain.handle('properties:save', (_, { serverId, props }) =>
    serverManager.saveServerProperties(serverId, props)
  )

  // Players, Whitelist, Ops, Bans
  ipcMain.handle('players:getAll', (_, serverId: string) => ({
    online: serverManager.getRuntimeState(serverId).playersOnline,
    whitelist: serverManager.getWhitelist(serverId),
    ops: serverManager.getOps(serverId),
    bans: serverManager.getBans(serverId)
  }))
  ipcMain.handle('players:whitelistAdd', (_, { serverId, name }) =>
    serverManager.addWhitelist(serverId, name)
  )
  ipcMain.handle('players:whitelistRemove', (_, { serverId, name }) =>
    serverManager.removeWhitelist(serverId, name)
  )
  ipcMain.handle('players:opAdd', (_, { serverId, name, level }) =>
    serverManager.addOp(serverId, name, level)
  )
  ipcMain.handle('players:opRemove', (_, { serverId, name }) =>
    serverManager.removeOp(serverId, name)
  )
  ipcMain.handle('players:banAdd', (_, { serverId, target, reason, isIp }) =>
    serverManager.addBan(serverId, target, reason, isIp)
  )
  ipcMain.handle('players:banRemove', (_, { serverId, target, isIp }) =>
    serverManager.removeBan(serverId, target, isIp)
  )

  // Java Manager
  ipcMain.handle('java:detect', () => javaManager.detectInstallations())
  ipcMain.handle('java:installTemurin', (_, major: 8 | 17 | 21 | 25) =>
    javaManager.installTemurin(major)
  )

  // Modrinth, Mods, Plugins, Modpacks
  ipcMain.handle('modrinth:search', (_, params) => modrinthService.searchProjects(params))
  ipcMain.handle('modrinth:versions', (_, { projectId, gameVersion, loader }) =>
    modrinthService.getProjectVersions(projectId, gameVersion, loader)
  )
  ipcMain.handle('modrinth:installAddon', (_, options) => modrinthService.installAddon(options))
  ipcMain.handle('modrinth:installModpack', (_, options) => modrinthService.installModpack(options))
  ipcMain.handle('addons:list', (_, serverId: string) =>
    modrinthService.listInstalledAddons(serverId)
  )
  ipcMain.handle('addons:toggle', (_, { serverId, filename, type }) =>
    modrinthService.toggleAddon(serverId, filename, type)
  )
  ipcMain.handle('addons:delete', (_, { serverId, filename, type }) =>
    modrinthService.deleteAddon(serverId, filename, type)
  )
  ipcMain.handle('addons:checkUpdates', (_, serverId: string) =>
    modrinthService.checkForAddonUpdates(serverId)
  )

  // File Manager, File Editor, Logs, Worlds
  ipcMain.handle('files:list', (_, { serverId, relDir }) =>
    fileService.listDirectory(serverId, relDir)
  )
  ipcMain.handle('files:read', (_, { serverId, relPath }) =>
    fileService.readTextFile(serverId, relPath)
  )
  ipcMain.handle('files:write', (_, { serverId, relPath, content }) =>
    fileService.writeTextFile(serverId, relPath, content)
  )
  ipcMain.handle('files:mkdir', (_, { serverId, relPath }) =>
    fileService.createDirectory(serverId, relPath)
  )
  ipcMain.handle('files:rename', (_, { serverId, oldRelPath, newName }) =>
    fileService.renameEntry(serverId, oldRelPath, newName)
  )
  ipcMain.handle('files:delete', (_, { serverId, relPath }) =>
    fileService.deleteEntry(serverId, relPath)
  )
  ipcMain.handle('files:uploadDialog', async (_, { serverId, destRelDir }) => {
    if (!mainWindow) return []
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections']
    })
    if (!res.canceled) {
      for (const f of res.filePaths) {
        fileService.copyExternalFileToServer(serverId, f, destRelDir)
      }
    }
    return fileService.listDirectory(serverId, destRelDir)
  })
  ipcMain.handle('files:extractZip', (_, { serverId, relZipPath, relTargetDir }) =>
    fileService.extractArchiveInServer(serverId, relZipPath, relTargetDir)
  )
  ipcMain.handle('files:compressZip', (_, { serverId, relPaths, outputRelZipPath }) =>
    fileService.compressEntriesInServer(serverId, relPaths, outputRelZipPath)
  )
  ipcMain.handle('logs:list', (_, serverId: string) => fileService.listLogFiles(serverId))
  ipcMain.handle('worlds:list', (_, serverId: string) => fileService.listWorlds(serverId))
  ipcMain.handle('worlds:reset', (_, { serverId, folderName }) =>
    fileService.resetWorld(serverId, folderName)
  )
  ipcMain.handle('worlds:export', async (_, { serverId, folderName }) => {
    if (!mainWindow) return null
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${folderName}-world.zip`,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
    })
    if (res.canceled || !res.filePath) return null
    await fileService.exportWorldZip(serverId, folderName, res.filePath)
    return res.filePath
  })
  ipcMain.handle('worlds:import', async (_, { serverId, folderName }) => {
    if (!mainWindow) return false
    const res = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return false
    await fileService.importWorldZip(serverId, res.filePaths[0], folderName)
    return true
  })

  // Backups & Restore
  ipcMain.handle('backups:list', (_, serverId?: string) => configService.getBackups(serverId))
  ipcMain.handle('backups:create', (_, options) => backupService.createBackup(options))
  ipcMain.handle('backups:restore', (_, { backupId, createSafetyBackup }) =>
    backupService.restoreBackup(backupId, createSafetyBackup)
  )
  ipcMain.handle('backups:delete', (_, backupId: string) => backupService.deleteBackup(backupId))

  // Scheduler
  ipcMain.handle('schedules:list', (_, serverId?: string) => configService.getSchedules(serverId))
  ipcMain.handle('schedules:save', (_, task) => schedulerService.createOrUpdateSchedule(task))
  ipcMain.handle('schedules:runNow', (_, taskId: string) => schedulerService.executeTask(taskId))
  ipcMain.handle('schedules:delete', (_, taskId: string) => schedulerService.deleteSchedule(taskId))

  // Built-in playit.gg & Networking
  ipcMain.handle('playit:getState', () => playitService.getState())
  ipcMain.handle('playit:startClaim', (_, openBrowser = true) =>
    playitService.startClaimFlow(openBrowser)
  )
  ipcMain.handle('playit:linkKey', (_, secretKey?: string) =>
    playitService.linkWithSecretKey(secretKey)
  )
  ipcMain.handle('playit:unlink', () => playitService.unlinkAccount())
  ipcMain.handle('playit:createTunnel', (_, { serverId, proto }) =>
    playitService.createOrEnableTunnel(serverId, proto)
  )
  ipcMain.handle('playit:toggleTunnel', (_, tunnelId: string) =>
    playitService.toggleTunnel(tunnelId)
  )
  ipcMain.handle('playit:deleteTunnel', (_, tunnelId: string) =>
    playitService.deleteTunnel(tunnelId)
  )
  ipcMain.handle('network:firewallAllow', (_, { port, ruleName }) =>
    monitorService.addWindowsFirewallRule(port, ruleName)
  )
  ipcMain.handle('network:publicIp', () => monitorService.getPublicIp())

  // System Monitoring, Storage, Settings, Security PIN, Diagnostics
  ipcMain.handle('system:metrics', () => monitorService.getSystemMetrics())
  ipcMain.handle('system:diagnostics', () => monitorService.generateDiagnosticsReport())
  ipcMain.handle('system:appLogs', () => getAppLogTail(300))
  ipcMain.handle('system:storageStats', () => {
    const settings = configService.getSettings()
    const serversUsage = configService.getServers().map((s) => ({
      id: s.id,
      name: s.name,
      bytes: getDirectorySize(s.directory)
    }))
    return {
      serversDir: settings.serversDir,
      backupsDir: settings.backupsDir,
      javaDir: settings.javaDir,
      cacheDir: configService.getCacheDir(),
      serversBytes: getDirectorySize(settings.serversDir),
      backupsBytes: getDirectorySize(settings.backupsDir),
      javaBytes: getDirectorySize(settings.javaDir),
      cacheBytes: getDirectorySize(configService.getCacheDir()),
      perServer: serversUsage
    }
  })
  ipcMain.handle('system:clearCache', () => {
    const cache = configService.getCacheDir()
    if (fs.existsSync(cache)) {
      fs.rmSync(cache, { recursive: true, force: true })
      fs.mkdirSync(cache, { recursive: true })
    }
    return true
  })

  ipcMain.handle('settings:get', () => configService.getSettings())
  ipcMain.handle('settings:update', (_, partial) => {
    const next = configService.updateSettings(partial)
    if (partial.launchOnStartup !== undefined) {
      try {
        app.setLoginItemSettings({ openAtLogin: Boolean(next.launchOnStartup) })
      } catch {
        // ignore in dev mode
      }
    }
    return next
  })

  ipcMain.handle('security:setPin', (_, plainPin: string) => {
    const pinHash = plainPin ? hashPin(plainPin) : ''
    return configService.updateSettings({
      pinEnabled: Boolean(plainPin),
      pinHash
    })
  })
  ipcMain.handle('security:verifyPin', (_, plainPin: string) => {
    const settings = configService.getSettings()
    return verifyPin(plainPin, settings.pinHash)
  })

  // Notifications & Activities
  ipcMain.handle('notifications:markRead', () => {
    configService.markNotificationsRead()
    return configService.getNotifications()
  })
  ipcMain.handle('notifications:clear', () => {
    configService.clearNotifications()
    return []
  })
  ipcMain.handle('activities:list', () => configService.getActivities())

  // Dialogs & Shell helpers
  ipcMain.handle('dialog:pickFolder', async () => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled ? null : res.filePaths[0]
  })
  ipcMain.handle('dialog:pickImportTarget', async () => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Minecraft Server Folder or ZIP Archive',
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Server Archive / JAR', extensions: ['zip', 'jar'] }]
    })
    return res.canceled ? null : res.filePaths[0]
  })
  ipcMain.handle('shell:openPath', (_, targetPath: string) => shell.openPath(targetPath))
  ipcMain.handle('shell:openExternal', (_, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      return shell.openExternal(url)
    }
  })

  // Auto-Updater
  ipcMain.handle('updater:check', () => updaterService.checkForUpdates())
  ipcMain.handle('updater:download', () => updaterService.downloadUpdate())
  ipcMain.handle('updater:install', () => updaterService.quitAndInstall())
}

function createWindow(): void {
  const iconPath = path.resolve('resources/icon.png')
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1020,
    minHeight: 680,
    frame: false,
    show: false,
    backgroundColor: '#0b111e',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    logger.error(`[Preload Error] ${preloadPath}:`, error)
    console.error(`[Preload Error] ${preloadPath}:`, error)
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logger.info(`[Renderer Console] [level=${level}] ${message} (${sourceId}:${line})`)
    console.log(`[Renderer Console] [level=${level}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error(`[Renderer did-fail-load] ${errorCode}: ${errorDescription} (${validatedURL})`)
    console.error(`[Renderer did-fail-load] ${errorCode}: ${errorDescription} (${validatedURL})`)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    if (configService.getSettings().minimizeToTray && !isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  logger.info('ChunkHarbor starting up...')
  wireServiceEvents()
  registerIpcHandlers()
  playitService.restoreSession()
  createWindow()
  trayService.init()

  // Start any servers marked autoStart
  for (const srv of configService.getServers()) {
    if (srv.autoStart) {
      serverManager.startServer(srv.id).catch((err) => {
        logger.error(`AutoStart failed for ${srv.name}`, err)
      })
    }
  }

  // Secret background update check whenever opened
  setTimeout(() => {
    logger.info('[App Startup] Running secret background update check...')
    updaterService.checkForUpdates(true).catch((err) => {
      logger.error('[App Startup] Secret update check failed:', err)
    })
  }, 2000)

  if (process.argv.includes('--test-launch')) {
    logger.info('[Test Launch] Flag --test-launch detected, verifying window load...')
    mainWindow?.webContents.on('did-finish-load', () => {
      logger.info('[Test Launch] MainWindow loaded successfully! UI rendered. Quitting test in 3s...')
      setTimeout(() => {
        isQuitting = true
        app.quit()
      }, 3000)
    })
  }
})

app.on('before-quit', async () => {
  isQuitting = true
  playitService.shutdown()
  await serverManager.stopAllServers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})
