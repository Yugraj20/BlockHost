import fs from 'fs'
import path from 'path'
import net from 'net'
import { spawn, execFileSync, ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'
import pidusage from 'pidusage'
import cron from 'node-cron'
import {
  ServerConfig,
  ServerRuntimeState,
  ServerSoftware,
  BanEntry,
  OpEntry,
  WhitelistEntry
} from '../../shared/types'
import { AIKAR_FLAGS, DEFAULT_SERVER_PROPERTIES } from '../../shared/constants'
import { ConfigService } from './ConfigService'
import { JavaManager } from './JavaManager'
import { ServerProviderService } from './providers/ServerProviderService'
import { ZipService } from './ZipService'
import { NotificationService } from './NotificationService'
import { logger } from '../utils/logger'

export class ServerManager extends EventEmitter {
  private processes: Map<string, ChildProcessWithoutNullStreams> = new Map()
  private states: Map<string, ServerRuntimeState> = new Map()
  private consoleLogs: Map<string, string[]> = new Map()
  private intentionalStops: Set<string> = new Set()
  private startTimestamps: Map<string, number> = new Map()
  private autoRestartJobs: Map<string, cron.ScheduledTask> = new Map()
  private metricsTimer?: NodeJS.Timeout

  constructor(
    private config: ConfigService,
    private javaManager: JavaManager,
    private providerService: ServerProviderService,
    private notifier: NotificationService
  ) {
    super()
    this.initializeStates()
    this.startMetricsLoop()
  }

  private initializeStates(): void {
    for (const server of this.config.getServers()) {
      this.states.set(server.id, this.createInitialRuntimeState(server))
      this.consoleLogs.set(server.id, [
        `[VoxelPulse] Server "${server.name}" (${server.software} ${server.version}) ready.`
      ])
      this.setupAutoRestartCron(server)
    }
  }

  private createInitialRuntimeState(server: ServerConfig): ServerRuntimeState {
    return {
      id: server.id,
      status: 'offline',
      cpuPercent: 0,
      ramUsedMb: 0,
      ramTotalMb: server.ramMb,
      tps: 20.0,
      uptimeSeconds: 0,
      playersOnline: [],
      crashLoopCount: 0,
      history: []
    }
  }

  public getRuntimeState(id: string): ServerRuntimeState {
    const server = this.config.getServer(id)
    if (!this.states.has(id) && server) {
      this.states.set(id, this.createInitialRuntimeState(server))
    }
    return (
      this.states.get(id) || {
        id,
        status: 'offline',
        cpuPercent: 0,
        ramUsedMb: 0,
        ramTotalMb: 4096,
        tps: 20,
        uptimeSeconds: 0,
        playersOnline: [],
        crashLoopCount: 0,
        history: []
      }
    )
  }

  public getAllRuntimeStates(): Record<string, ServerRuntimeState> {
    const out: Record<string, ServerRuntimeState> = {}
    for (const srv of this.config.getServers()) {
      out[srv.id] = this.getRuntimeState(srv.id)
    }
    return out
  }

  public getConsoleLines(serverId: string): string[] {
    return this.consoleLogs.get(serverId) || []
  }

  public clearConsoleLines(serverId: string): void {
    this.consoleLogs.set(serverId, [])
    this.emit('console:clear', serverId)
  }

  private appendConsole(serverId: string, line: string): void {
    const arr = this.consoleLogs.get(serverId) || []
    arr.push(line)
    if (arr.length > 1500) arr.shift()
    this.consoleLogs.set(serverId, arr)
    this.emit('console:line', { serverId, line })
  }

  /**
   * Check whether a local TCP port is free.
   */
  public async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net
        .createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.close(() => resolve(true))
        })
        .listen(port, '0.0.0.0')
    })
  }

  public async findNextFreePort(startPort = 25565): Promise<number> {
    const usedByConfigs = new Set(this.config.getServers().map((s) => s.port))
    let candidate = startPort
    while (candidate < 65530) {
      if (!usedByConfigs.has(candidate) && (await this.isPortFree(candidate))) {
        return candidate
      }
      candidate++
    }
    return startPort
  }

  /**
   * Create a brand new Minecraft server from the Creation Wizard.
   */
  public async createServer(input: {
    name: string
    software: ServerSoftware
    version: string
    port: number
    ramMb: number
    maxPlayers: number
    motd: string
    gamemode: 'survival' | 'creative' | 'adventure' | 'spectator'
    difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'
    aikarFlags: boolean
    thumbnail: string
    eulaAccepted: boolean
  }): Promise<ServerConfig> {
    if (!input.eulaAccepted) {
      throw new Error('You must accept the Minecraft EULA to create a server.')
    }

    const id = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const safeFolder = input.name.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + id.slice(-4)
    const directory = path.join(this.config.getSettings().serversDir, safeFolder)
    fs.mkdirSync(directory, { recursive: true })

    const server: ServerConfig = {
      id,
      name: input.name,
      software: input.software,
      version: input.version,
      port: input.port,
      ramMb: input.ramMb,
      minRamMb: Math.max(1024, Math.floor(input.ramMb / 2)),
      javaPath: 'auto',
      jvmArgs: '',
      aikarFlags: input.aikarFlags,
      jarFile: 'server.jar',
      directory,
      thumbnail: input.thumbnail || `bg-${(this.config.getServers().length % 16) + 1}`,
      maxPlayers: input.maxPlayers,
      motd: input.motd || `${input.name} - Powered by VoxelPulse`,
      gamemode: input.gamemode,
      difficulty: input.difficulty,
      onlineMode: true,
      pvp: true,
      whitelistEnabled: false,
      levelName: 'world',
      autoStart: false,
      autoRestartOnCrash: true,
      autoRestartMaxRetries: 3,
      autoRestartRamLimitPercent: 0,
      autoRestartScheduleCron: '',
      createdAt: Date.now()
    }

    // Write eula.txt and initial server.properties
    fs.writeFileSync(
      path.join(directory, 'eula.txt'),
      `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\n#${new Date().toUTCString()}\neula=true\n`,
      'utf-8'
    )
    this.writeServerPropertiesSync(server)

    // Create mods/plugins/logs directories
    fs.mkdirSync(path.join(directory, 'logs'), { recursive: true })
    if (['fabric', 'quilt', 'forge', 'neoforge'].includes(server.software)) {
      fs.mkdirSync(path.join(directory, 'mods'), { recursive: true })
    }
    if (['paper', 'purpur'].includes(server.software)) {
      fs.mkdirSync(path.join(directory, 'plugins'), { recursive: true })
    }

    const state = this.createInitialRuntimeState(server)
    state.status = 'installing'
    this.states.set(id, state)
    this.consoleLogs.set(id, [
      `[VoxelPulse] Creating server "${server.name}" (${server.software} ${server.version})...`
    ])
    this.config.upsertServer(server)
    this.emitStateUpdate()

    try {
      const javaBin = await this.javaManager.resolveJavaForServer(server.version, server.javaPath)
      this.appendConsole(id, `[VoxelPulse] Downloading ${server.software} ${server.version}...`)
      const installed = await this.providerService.installServerJar({
        software: server.software,
        version: server.version,
        targetDir: directory,
        javaBin
      })
      server.jarFile = installed.jarFile
      server.build = installed.build
      this.config.upsertServer(server)

      state.status = 'offline'
      this.appendConsole(id, `[VoxelPulse] Installation complete (${server.jarFile}). Ready to start!`)
      this.config.addActivity({
        serverId: server.id,
        serverName: server.name,
        type: 'system',
        title: `Created server ${server.name}`,
        subtitle: `${server.software.toUpperCase()} ${server.version} on port ${server.port}`
      })
      this.emitStateUpdate()
      return server
    } catch (err) {
      state.status = 'offline'
      this.appendConsole(
        id,
        `[VoxelPulse/WARN] Could not download jar right now (${(err as Error).message}). You can retry or place server.jar manually.`
      )
      this.emitStateUpdate()
      return server
    }
  }

  /**
   * Import an existing server folder or .zip archive, auto-detecting software, jar, and properties.
   */
  public async importServer(sourcePath: string, customName?: string): Promise<ServerConfig> {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Import source does not exist: ${sourcePath}`)
    }

    const id = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const baseName = customName || path.basename(sourcePath, path.extname(sourcePath))
    const safeFolder = baseName.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + id.slice(-4)
    const targetDir = path.join(this.config.getSettings().serversDir, safeFolder)
    fs.mkdirSync(targetDir, { recursive: true })

    const stat = fs.statSync(sourcePath)
    if (stat.isFile() && sourcePath.toLowerCase().endsWith('.zip')) {
      await ZipService.extractZip(sourcePath, targetDir)
      // If ZIP contained a single top-level directory, flatten it
      const entries = fs.readdirSync(targetDir)
      if (entries.length === 1) {
        const inner = path.join(targetDir, entries[0])
        if (fs.statSync(inner).isDirectory()) {
          for (const sub of fs.readdirSync(inner)) {
            fs.renameSync(path.join(inner, sub), path.join(targetDir, sub))
          }
          fs.rmdirSync(inner)
        }
      }
    } else if (stat.isDirectory()) {
      fs.cpSync(sourcePath, targetDir, { recursive: true })
    } else {
      throw new Error('Unsupported import target. Please choose a server directory or .zip file.')
    }

    // Auto-detect jar and software
    const files = fs.readdirSync(targetDir)
    let software: ServerSoftware = 'vanilla'
    let jarFile = files.find((f) => f.endsWith('.jar')) || 'server.jar'
    let version = '1.20.4'

    for (const f of files) {
      const lower = f.toLowerCase()
      if (lower.includes('paper')) {
        software = 'paper'
        jarFile = f
      } else if (lower.includes('purpur')) {
        software = 'purpur'
        jarFile = f
      } else if (lower.includes('fabric')) {
        software = 'fabric'
        jarFile = f
      } else if (lower.includes('quilt')) {
        software = 'quilt'
        jarFile = f
      } else if (lower.includes('neoforge')) {
        software = 'neoforge'
        jarFile = f
      } else if (lower.includes('forge')) {
        software = 'forge'
        jarFile = f
      }
      const verMatch = f.match(/1\.\d+(?:\.\d+)?/)
      if (verMatch) version = verMatch[0]
    }

    const props = this.readServerPropertiesMap(targetDir)
    const port = parseInt(props['server-port'] || '25565', 10)
    const maxPlayers = parseInt(props['max-players'] || '20', 10)

    // Ensure eula=true
    fs.writeFileSync(path.join(targetDir, 'eula.txt'), 'eula=true\n', 'utf-8')

    const server: ServerConfig = {
      id,
      name: baseName,
      software,
      version,
      port: isNaN(port) ? 25565 : port,
      ramMb: 4096,
      minRamMb: 2048,
      javaPath: 'auto',
      jvmArgs: '',
      aikarFlags: true,
      jarFile,
      directory: targetDir,
      thumbnail: `bg-${(this.config.getServers().length % 16) + 1}`,
      maxPlayers: isNaN(maxPlayers) ? 20 : maxPlayers,
      motd: props['motd'] || `${baseName} (Imported)`,
      gamemode: (props['gamemode'] as ServerConfig['gamemode']) || 'survival',
      difficulty: (props['difficulty'] as ServerConfig['difficulty']) || 'normal',
      onlineMode: props['online-mode'] !== 'false',
      pvp: props['pvp'] !== 'false',
      whitelistEnabled: props['white-list'] === 'true',
      levelName: props['level-name'] || 'world',
      autoStart: false,
      autoRestartOnCrash: true,
      autoRestartMaxRetries: 3,
      autoRestartRamLimitPercent: 0,
      autoRestartScheduleCron: '',
      createdAt: Date.now()
    }

    this.states.set(id, this.createInitialRuntimeState(server))
    this.consoleLogs.set(id, [`[VoxelPulse] Imported server "${server.name}" from ${sourcePath}`])
    this.config.upsertServer(server)
    this.config.addActivity({
      serverId: server.id,
      serverName: server.name,
      type: 'system',
      title: `Imported server ${server.name}`,
      subtitle: `Detected ${software.toUpperCase()} ${version}`
    })
    this.emitStateUpdate()
    return server
  }

  /**
   * Start a Minecraft server process.
   */
  public async startServer(serverId: string): Promise<void> {
    const server = this.config.getServer(serverId)
    if (!server) throw new Error('Server not found')

    if (this.processes.has(serverId)) {
      throw new Error('Server is already running')
    }

    // Check port conflicts across other running servers
    for (const [otherId] of this.processes) {
      const other = this.config.getServer(otherId)
      if (other && other.port === server.port) {
        throw new Error(`Port ${server.port} is already in use by "${other.name}"`)
      }
    }

    const jarFullPath = path.join(server.directory, server.jarFile)
    if (!server.jarFile.startsWith('@') && !fs.existsSync(jarFullPath)) {
      // Attempt on-demand download if jar is missing
      const javaForInstall = await this.javaManager.resolveJavaForServer(server.version, server.javaPath)
      this.appendConsole(serverId, `[VoxelPulse] Server JAR missing, downloading ${server.software} ${server.version}...`)
      const installed = await this.providerService.installServerJar({
        software: server.software,
        version: server.version,
        targetDir: server.directory,
        javaBin: javaForInstall
      })
      server.jarFile = installed.jarFile
      this.config.upsertServer(server)
    }

    // Ensure eula.txt is accepted
    fs.writeFileSync(path.join(server.directory, 'eula.txt'), 'eula=true\n', 'utf-8')

    const javaBin = await this.javaManager.resolveJavaForServer(server.version, server.javaPath)
    const args: string[] = [
      `-Xms${server.minRamMb}M`,
      `-Xmx${server.ramMb}M`
    ]

    if (server.aikarFlags) {
      args.push(...AIKAR_FLAGS.split(' '))
    }

    if (server.jvmArgs.trim()) {
      args.push(...server.jvmArgs.trim().split(/\s+/))
    }

    if (server.jarFile.startsWith('@')) {
      args.push(server.jarFile, 'nogui')
    } else {
      args.push('-jar', server.jarFile, 'nogui')
    }

    const state = this.getRuntimeState(serverId)
    state.status = 'starting'
    state.playersOnline = []
    state.ramTotalMb = server.ramMb
    this.intentionalStops.delete(serverId)
    this.startTimestamps.set(serverId, Date.now())
    this.emitStateUpdate()

    this.appendConsole(
      serverId,
      `[VoxelPulse] Starting ${server.name} with Java: "${javaBin}" (-Xmx${server.ramMb}M) on port ${server.port}`
    )

    const child = spawn(javaBin, args, {
      cwd: server.directory,
      stdio: 'pipe',
      windowsHide: true
    })

    this.processes.set(serverId, child)
    state.pid = child.pid
    server.lastStartedAt = Date.now()
    this.config.upsertServer(server)

    const handleChunk = (data: Buffer) => {
      const text = data.toString('utf-8')
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trimEnd()
        if (!line) continue
        this.appendConsole(serverId, line)
        this.parseServerOutputLine(server, state, line)
      }
    }

    child.stdout.on('data', handleChunk)
    child.stderr.on('data', handleChunk)

    child.on('error', (err) => {
      this.appendConsole(serverId, `[VoxelPulse/ERROR] Process error: ${err.message}`)
    })

    child.on('close', (code) => {
      this.processes.delete(serverId)
      this.startTimestamps.delete(serverId)
      state.pid = undefined
      state.cpuPercent = 0
      state.ramUsedMb = 0
      state.uptimeSeconds = 0
      state.playersOnline = []

      const wasIntentional = this.intentionalStops.has(serverId)
      this.intentionalStops.delete(serverId)

      if (!wasIntentional && code !== 0) {
        state.status = 'crashed'
        state.crashLoopCount += 1
        state.lastCrashReport = this.readLatestCrashReport(server.directory)
        this.appendConsole(serverId, `[VoxelPulse/CRASH] Server exited abnormally with code ${code}.`)

        this.config.addActivity({
          serverId: server.id,
          serverName: server.name,
          type: 'server_crash',
          title: `${server.name} crashed`,
          subtitle: `Exit code ${code}`
        })

        this.notifier.notify({
          title: `Server Crashed: ${server.name}`,
          body: `${server.name} exited with code ${code}.`,
          level: 'error',
          category: 'crash'
        })

        if (server.autoRestartOnCrash && state.crashLoopCount <= server.autoRestartMaxRetries) {
          const delaySec = Math.min(30, state.crashLoopCount * 5)
          this.appendConsole(
            serverId,
            `[VoxelPulse/Recovery] Auto-restarting in ${delaySec}s (Attempt ${state.crashLoopCount}/${server.autoRestartMaxRetries})...`
          )
          setTimeout(() => {
            if (!this.processes.has(serverId)) {
              this.startServer(serverId).catch((e) =>
                logger.error(`Crash recovery restart failed for ${server.name}`, e)
              )
            }
          }, delaySec * 1000)
        }
      } else {
        state.status = 'offline'
        state.crashLoopCount = 0
        this.appendConsole(serverId, `[VoxelPulse] Server stopped (code ${code ?? 0}).`)
        this.config.addActivity({
          serverId: server.id,
          serverName: server.name,
          type: 'server_stop',
          title: `Server stopped: ${server.name}`,
          subtitle: 'Graceful shutdown completed'
        })
      }

      this.emitStateUpdate()
    })
  }

  private parseServerOutputLine(server: ServerConfig, state: ServerRuntimeState, line: string): void {
    // 1. Server ready detection: Done (X.XXXs)! For help, type "help"
    if (/Done \([\d.,]+s\)! For help/i.test(line)) {
      state.status = 'online'
      state.crashLoopCount = 0
      this.config.addActivity({
        serverId: server.id,
        serverName: server.name,
        type: 'server_start',
        title: `Server started: ${server.name}`,
        subtitle: `Online on port ${server.port}`
      })
      this.emitStateUpdate()
    }

    // 2. Player UUID authenticator log (supports Java and Geyser/Floodgate Bedrock names)
    const uuidMatch = line.match(/(?:UUID of player|User)\s+([A-Za-z0-9_.*-]{1,20})\s+(?:\([^)]*\)\s+)?(?:is|has UUID)\s+([0-9a-fA-F-]{32,36})/)
    if (uuidMatch) {
      const [, name, uuid] = uuidMatch
      const existing = state.playersOnline.find((p) => p.name.toLowerCase() === name.toLowerCase())
      if (existing) {
        existing.uuid = uuid
      } else {
        state.playersOnline.push({ name, uuid, joinedAt: Date.now() })
      }
      this.emitStateUpdate()
    }

    // 3. Player joined the game
    const joinMatch = line.match(/(?:\[Server thread\/INFO\]|\[Server-Worker-[^\]]+\]|\]):\s+([A-Za-z0-9_.*-]{1,20})\s+(?:joined the game|logged in)/)
    if (joinMatch) {
      const name = joinMatch[1]
      if (!state.playersOnline.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        state.playersOnline.push({ name, uuid: '', joinedAt: Date.now() })
      }
      this.config.addActivity({
        serverId: server.id,
        serverName: server.name,
        type: 'player_join',
        title: `${name} joined ${server.name}`,
        subtitle: `${state.playersOnline.length} / ${server.maxPlayers} players online`
      })
      this.notifier.notify({
        title: `Player Joined: ${name}`,
        body: `${name} connected to ${server.name}`,
        level: 'info',
        category: 'player_join'
      })
      this.emitStateUpdate()
    }

    // 4. Player left the game
    const leaveMatch = line.match(/(?:\[Server thread\/INFO\]|\[Server-Worker-[^\]]+\]|\]):\s+([A-Za-z0-9_.*-]{1,20})\s+(?:left the game|lost connection)/)
    if (leaveMatch) {
      const name = leaveMatch[1]
      state.playersOnline = state.playersOnline.filter(
        (p) => p.name.toLowerCase() !== name.toLowerCase()
      )
      this.config.addActivity({
        serverId: server.id,
        serverName: server.name,
        type: 'player_leave',
        title: `${name} left ${server.name}`,
        subtitle: `${state.playersOnline.length} / ${server.maxPlayers} players online`
      })
      this.emitStateUpdate()
    }

    // 5. Online player list output (e.g. from `/list` or server query)
    const listMatch = line.match(/There are \d+ of a max of \d+ players online:\s*(.*)/i)
    if (listMatch) {
      const rawList = listMatch[1].trim()
      if (rawList) {
        const names = rawList.split(',').map((s) => s.trim()).filter(Boolean)
        const currentMap = new Map(state.playersOnline.map((p) => [p.name.toLowerCase(), p]))
        state.playersOnline = names.map((n) => currentMap.get(n.toLowerCase()) || { name: n, uuid: '', joinedAt: Date.now() })
      } else {
        state.playersOnline = []
      }
      this.emitStateUpdate()
    }

    // 6. TPS parsing from Paper/Purpur `/tps` output (stripping terminal ANSI and section color formatting)
    const cleanLine = line.replace(/\x1b\[[0-9;]*m|§[0-9a-fk-or]/gi, '')
    const tpsMatch = cleanLine.match(/TPS from last 1m, 5m, 15m:\s*\*?([\d.]+)/i)
    if (tpsMatch) {
      const parsed = parseFloat(tpsMatch[1])
      if (!isNaN(parsed)) state.tps = Math.min(20, parsed)
    }
  }

  private readLatestCrashReport(serverDir: string): string | undefined {
    const crashDir = path.join(serverDir, 'crash-reports')
    if (!fs.existsSync(crashDir)) return undefined
    const files = fs
      .readdirSync(crashDir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(crashDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)

    if (files.length === 0) return undefined
    return fs.readFileSync(path.join(crashDir, files[0].name), 'utf-8').slice(0, 6000)
  }

  /**
   * Send a console command to a running server's stdin.
   */
  public sendCommand(serverId: string, command: string): void {
    const proc = this.processes.get(serverId)
    if (!proc || !proc.stdin.writable) {
      this.appendConsole(serverId, `[VoxelPulse/WARN] Cannot send command: server is not running.`)
      return
    }
    const clean = command.replace(/^\//, '').trim()
    this.appendConsole(serverId, `> ${clean}`)
    proc.stdin.write(`${clean}\n`)
  }

  /**
   * Gracefully stop a running server (falls back to kill after timeout).
   */
  public async stopServer(serverId: string): Promise<void> {
    const proc = this.processes.get(serverId)
    if (!proc) return

    const state = this.getRuntimeState(serverId)
    state.status = 'stopping'
    this.intentionalStops.add(serverId)
    this.emitStateUpdate()

    this.sendCommand(serverId, 'save-all')
    this.sendCommand(serverId, 'stop')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.processes.has(serverId)) {
          this.appendConsole(serverId, `[VoxelPulse] Force-terminating unresponsive server process...`)
          if (process.platform === 'win32' && proc.pid) {
            try {
              execFileSync('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {
                windowsHide: true
              })
            } catch {
              proc.kill('SIGKILL')
            }
          } else {
            proc.kill('SIGKILL')
          }
        }
        resolve()
      }, 15000)

      proc.once('close', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  public async restartServer(serverId: string): Promise<void> {
    if (this.processes.has(serverId)) {
      await this.stopServer(serverId)
    }
    await this.startServer(serverId)
  }

  public async deleteServer(serverId: string): Promise<void> {
    if (this.processes.has(serverId)) {
      await this.stopServer(serverId)
    }
    const srv = this.config.getServer(serverId)
    if (srv && fs.existsSync(srv.directory)) {
      fs.rmSync(srv.directory, { recursive: true, force: true })
    }
    this.autoRestartJobs.get(serverId)?.stop()
    this.autoRestartJobs.delete(serverId)
    this.states.delete(serverId)
    this.consoleLogs.delete(serverId)
    this.config.removeServer(serverId)
    this.emitStateUpdate()
  }

  /**
   * Read & write `server.properties`
   */
  public readServerPropertiesMap(serverDir: string): Record<string, string> {
    const propPath = path.join(serverDir, 'server.properties')
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(DEFAULT_SERVER_PROPERTIES)) {
      out[k] = v.value
    }
    if (!fs.existsSync(propPath)) return out

    const lines = fs.readFileSync(propPath, 'utf-8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim()
        const val = trimmed.slice(eq + 1).trim()
        out[key] = val
      }
    }
    return out
  }

  public writeServerPropertiesSync(server: ServerConfig, extraProps?: Record<string, string>): void {
    const existing = this.readServerPropertiesMap(server.directory)
    const merged: Record<string, string> = {
      ...existing,
      ...(extraProps || {}),
      'server-port': String(server.port),
      'max-players': String(server.maxPlayers),
      'motd': server.motd,
      'gamemode': server.gamemode,
      'difficulty': server.difficulty,
      'online-mode': String(server.onlineMode),
      'pvp': String(server.pvp),
      'white-list': String(server.whitelistEnabled),
      'level-name': server.levelName
    }

    const lines = ['#Minecraft server properties', `#Managed by VoxelPulse - ${new Date().toISOString()}`]
    for (const [k, v] of Object.entries(merged)) {
      lines.push(`${k}=${v}`)
    }
    fs.writeFileSync(path.join(server.directory, 'server.properties'), lines.join('\n') + '\n', 'utf-8')
  }

  public saveServerProperties(serverId: string, props: Record<string, string>): ServerConfig {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error('Server not found')

    if (props['server-port']) srv.port = parseInt(props['server-port'], 10) || srv.port
    if (props['max-players']) srv.maxPlayers = parseInt(props['max-players'], 10) || srv.maxPlayers
    if (props['motd'] !== undefined) srv.motd = props['motd']
    if (props['gamemode']) srv.gamemode = props['gamemode'] as ServerConfig['gamemode']
    if (props['difficulty']) srv.difficulty = props['difficulty'] as ServerConfig['difficulty']
    if (props['online-mode'] !== undefined) srv.onlineMode = props['online-mode'] === 'true'
    if (props['pvp'] !== undefined) srv.pvp = props['pvp'] === 'true'
    if (props['white-list'] !== undefined) srv.whitelistEnabled = props['white-list'] === 'true'
    if (props['level-name']) srv.levelName = props['level-name']

    this.writeServerPropertiesSync(srv, props)
    this.config.upsertServer(srv)
    return srv
  }

  /**
   * Player management: Whitelist, Ops, Bans + Mojang UUID lookup
   */
  public async lookupMojangUuid(username: string): Promise<string> {
    try {
      const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`)
      if (res.ok) {
        const data = (await res.json()) as { id: string }
        // Format 32-char hex into standard hyphenated UUID
        return data.id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
      }
    } catch {
      // Offline fallback UUID v3
    }
    return `00000000-0000-3000-8000-${Buffer.from(username.padEnd(12, '0').slice(0, 12)).toString('hex').slice(0, 12)}`
  }

  private readJsonFile<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) return fallback
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
    } catch {
      return fallback
    }
  }

  public getWhitelist(serverId: string): WhitelistEntry[] {
    const srv = this.config.getServer(serverId)
    if (!srv) return []
    return this.readJsonFile<WhitelistEntry[]>(path.join(srv.directory, 'whitelist.json'), [])
  }

  public async addWhitelist(serverId: string, name: string): Promise<WhitelistEntry[]> {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error('Server not found')
    const list = this.getWhitelist(serverId)
    if (!list.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      const uuid = await this.lookupMojangUuid(name)
      list.push({ name, uuid })
      fs.writeFileSync(path.join(srv.directory, 'whitelist.json'), JSON.stringify(list, null, 2))
    }
    if (this.processes.has(serverId)) this.sendCommand(serverId, `whitelist add ${name}`)
    return list
  }

  public removeWhitelist(serverId: string, name: string): WhitelistEntry[] {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error('Server not found')
    const list = this.getWhitelist(serverId).filter((e) => e.name.toLowerCase() !== name.toLowerCase())
    fs.writeFileSync(path.join(srv.directory, 'whitelist.json'), JSON.stringify(list, null, 2))
    if (this.processes.has(serverId)) this.sendCommand(serverId, `whitelist remove ${name}`)
    return list
  }

  public getOps(serverId: string): OpEntry[] {
    const srv = this.config.getServer(serverId)
    if (!srv) return []
    return this.readJsonFile<OpEntry[]>(path.join(srv.directory, 'ops.json'), [])
  }

  public async addOp(serverId: string, name: string, level = 4): Promise<OpEntry[]> {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error('Server not found')
    const list = this.getOps(serverId).filter((e) => e.name.toLowerCase() !== name.toLowerCase())
    const uuid = await this.lookupMojangUuid(name)
    list.push({ uuid, name, level, bypassesPlayerLimit: true })
    fs.writeFileSync(path.join(srv.directory, 'ops.json'), JSON.stringify(list, null, 2))
    if (this.processes.has(serverId)) this.sendCommand(serverId, `op ${name}`)
    return list
  }

  public removeOp(serverId: string, name: string): OpEntry[] {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error('Server not found')
    const list = this.getOps(serverId).filter((e) => e.name.toLowerCase() !== name.toLowerCase())
    fs.writeFileSync(path.join(srv.directory, 'ops.json'), JSON.stringify(list, null, 2))
    if (this.processes.has(serverId)) this.sendCommand(serverId, `deop ${name}`)
    return list
  }

  public getBans(serverId: string): { players: BanEntry[]; ips: BanEntry[] } {
    const srv = this.config.getServer(serverId)
    if (!srv) return { players: [], ips: [] }
    return {
      players: this.readJsonFile<BanEntry[]>(path.join(srv.directory, 'banned-players.json'), []),
      ips: this.readJsonFile<BanEntry[]>(path.join(srv.directory, 'banned-ips.json'), [])
    }
  }

  public async addBan(
    serverId: string,
    target: string,
    reason = 'Banned by an operator',
    isIp = false
  ): Promise<{ players: BanEntry[]; ips: BanEntry[] }> {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error('Server not found')
    const current = this.getBans(serverId)
    const entry: BanEntry = {
      created: new Date().toISOString(),
      source: 'VoxelPulse Console',
      expires: 'forever',
      reason
    }

    if (isIp) {
      entry.ip = target
      current.ips = current.ips.filter((b) => b.ip !== target)
      current.ips.push(entry)
      fs.writeFileSync(path.join(srv.directory, 'banned-ips.json'), JSON.stringify(current.ips, null, 2))
      if (this.processes.has(serverId)) this.sendCommand(serverId, `ban-ip ${target} ${reason}`)
    } else {
      entry.name = target
      entry.uuid = await this.lookupMojangUuid(target)
      current.players = current.players.filter((b) => b.name?.toLowerCase() !== target.toLowerCase())
      current.players.push(entry)
      fs.writeFileSync(
        path.join(srv.directory, 'banned-players.json'),
        JSON.stringify(current.players, null, 2)
      )
      if (this.processes.has(serverId)) this.sendCommand(serverId, `ban ${target} ${reason}`)
    }
    return current
  }

  public removeBan(serverId: string, target: string, isIp = false): { players: BanEntry[]; ips: BanEntry[] } {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error('Server not found')
    const current = this.getBans(serverId)
    if (isIp) {
      current.ips = current.ips.filter((b) => b.ip !== target)
      fs.writeFileSync(path.join(srv.directory, 'banned-ips.json'), JSON.stringify(current.ips, null, 2))
      if (this.processes.has(serverId)) this.sendCommand(serverId, `pardon-ip ${target}`)
    } else {
      current.players = current.players.filter((b) => b.name?.toLowerCase() !== target.toLowerCase())
      fs.writeFileSync(
        path.join(srv.directory, 'banned-players.json'),
        JSON.stringify(current.players, null, 2)
      )
      if (this.processes.has(serverId)) this.sendCommand(serverId, `pardon ${target}`)
    }
    return current
  }

  public setupAutoRestartCron(server: ServerConfig): void {
    this.autoRestartJobs.get(server.id)?.stop()
    this.autoRestartJobs.delete(server.id)

    if (server.autoRestartScheduleCron && cron.validate(server.autoRestartScheduleCron)) {
      const job = cron.schedule(server.autoRestartScheduleCron, () => {
        if (this.processes.has(server.id)) {
          this.appendConsole(server.id, `[VoxelPulse] Scheduled auto-restart triggered.`)
          this.sendCommand(server.id, 'say [VoxelPulse] Scheduled server restart in 10 seconds!')
          setTimeout(() => this.restartServer(server.id), 10000)
        }
      })
      this.autoRestartJobs.set(server.id, job)
    }
  }

  private startMetricsLoop(): void {
    this.metricsTimer = setInterval(async () => {
      let changed = false
      for (const [serverId, proc] of this.processes.entries()) {
        if (!proc.pid) continue
        const state = this.getRuntimeState(serverId)
        const srv = this.config.getServer(serverId)
        if (!srv) continue

        try {
          const stats = await pidusage(proc.pid)
          state.cpuPercent = Math.min(100, Math.round(stats.cpu * 10) / 10)
          state.ramUsedMb = Math.round(stats.memory / (1024 * 1024))
          state.ramTotalMb = srv.ramMb
          const startedAt = this.startTimestamps.get(serverId) || Date.now()
          state.uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000)

          state.history.push({
            timestamp: Date.now(),
            cpu: state.cpuPercent,
            ramMb: state.ramUsedMb,
            players: state.playersOnline.length,
            tps: state.tps
          })
          if (state.history.length > 60) state.history.shift()

          // Check RAM threshold auto-restart
          if (
            srv.autoRestartRamLimitPercent > 0 &&
            state.status === 'online' &&
            (state.ramUsedMb / srv.ramMb) * 100 >= srv.autoRestartRamLimitPercent
          ) {
            this.appendConsole(
              serverId,
              `[VoxelPulse/Guard] RAM usage (${state.ramUsedMb} MB) exceeded ${srv.autoRestartRamLimitPercent}% threshold. Restarting...`
            )
            this.restartServer(serverId).catch(() => {})
          }

          changed = true
        } catch {
          // Process may have just exited
        }
      }

      if (changed) {
        this.emitStateUpdate()
      }
    }, 2000)
  }

  public async stopAllServers(): Promise<void> {
    if (this.metricsTimer) clearInterval(this.metricsTimer)
    const ids = Array.from(this.processes.keys())
    await Promise.all(ids.map((id) => this.stopServer(id)))
  }

  private emitStateUpdate(): void {
    this.emit('state:updated', this.getAllRuntimeStates())
  }
}
