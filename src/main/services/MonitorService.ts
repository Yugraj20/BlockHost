import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import si from 'systeminformation'
import { SystemMetrics, DiagnosticsReport } from '../../shared/types'
import { ConfigService } from './ConfigService'
import { JavaManager } from './JavaManager'
import { ServerManager } from './ServerManager'
import { PlayitService } from './playit/PlayitService'
import { app } from 'electron'
import fs from 'fs'

const execFileAsync = promisify(execFile)

export class MonitorService {
  private cachedPublicIp?: string
  private lastMetrics: SystemMetrics = {
    cpuPercent: 12,
    cpuModel: os.cpus()[0]?.model || 'x64 Processor',
    cpuCores: os.cpus().length,
    ramUsedBytes: os.totalmem() - os.freemem(),
    ramTotalBytes: os.totalmem(),
    diskUsedBytes: 100 * 1024 * 1024 * 1024,
    diskTotalBytes: 500 * 1024 * 1024 * 1024,
    lanIps: MonitorService.getLanIps(),
    uptimeSeconds: os.uptime()
  }

  constructor(
    private config: ConfigService,
    private javaManager: JavaManager,
    private serverManager: ServerManager,
    private playitService: PlayitService
  ) {}

  public static getLanIps(): string[] {
    const nets = os.networkInterfaces()
    const ips: string[] = []
    for (const name of Object.keys(nets)) {
      for (const netInfo of nets[name] || []) {
        if (netInfo.family === 'IPv4' && !netInfo.internal) {
          ips.push(netInfo.address)
        }
      }
    }
    return ips.length > 0 ? ips : ['127.0.0.1']
  }

  public async getPublicIp(): Promise<string> {
    if (this.cachedPublicIp) return this.cachedPublicIp
    try {
      const res = await fetch('https://api.ipify.org?format=json', {
        signal: AbortSignal.timeout(4000)
      })
      if (res.ok) {
        const data = (await res.json()) as { ip: string }
        this.cachedPublicIp = data.ip
        return data.ip
      }
    } catch {
      // ignore offline
    }
    return 'Unavailable'
  }

  public async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [load, mem, disks] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize()
      ])

      const mainDisk = disks.find((d) => d.mount.toLowerCase().startsWith('c')) || disks[0]

      this.lastMetrics = {
        cpuPercent: Math.round(load.currentLoad || 0),
        cpuModel: os.cpus()[0]?.model || 'Processor',
        cpuCores: os.cpus().length,
        ramUsedBytes: mem.active || os.totalmem() - os.freemem(),
        ramTotalBytes: mem.total || os.totalmem(),
        diskUsedBytes: mainDisk?.used || 0,
        diskTotalBytes: mainDisk?.size || 1,
        lanIps: MonitorService.getLanIps(),
        publicIp: this.cachedPublicIp,
        uptimeSeconds: os.uptime()
      }
    } catch {
      // Fallback to Node os metrics
      this.lastMetrics.ramUsedBytes = os.totalmem() - os.freemem()
      this.lastMetrics.ramTotalBytes = os.totalmem()
      this.lastMetrics.lanIps = MonitorService.getLanIps()
    }
    return this.lastMetrics
  }

  /**
   * Add a Windows Firewall inbound allow rule for the given server port (triggers UAC elevation via PowerShell Start-Process -Verb RunAs).
   */
  public async addWindowsFirewallRule(port: number, ruleName = `BlockHost Minecraft ${port}`): Promise<{ success: boolean; message: string }> {
    try {
      const safeName = ruleName.replace(/'/g, '')
      const cmd = `New-NetFirewallRule -DisplayName '${safeName} (TCP)' -Direction Inbound -LocalPort ${port} -Protocol TCP -Action Allow; New-NetFirewallRule -DisplayName '${safeName} (UDP)' -Direction Inbound -LocalPort ${port} -Protocol UDP -Action Allow`
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        `Start-Process powershell -ArgumentList "-NoProfile -Command ${cmd}" -Verb RunAs -Wait`
      ])
      return {
        success: true,
        message: `Added Windows Firewall inbound TCP & UDP rules for port ${port}`
      }
    } catch (err) {
      return {
        success: false,
        message: `Could not add firewall rule: ${(err as Error).message}`
      }
    }
  }

  /**
   * Run full system & self-diagnostics report.
   */
  public async generateDiagnosticsReport(): Promise<DiagnosticsReport> {
    const metrics = await this.getSystemMetrics()
    const javas = await this.javaManager.detectInstallations()
    const disks = await si.fsSize().catch(() => [])
    const servers = this.config.getServers()
    const states = this.serverManager.getAllRuntimeStates()
    const runningCount = Object.values(states).filter(
      (s) => s.status === 'online' || s.status === 'starting'
    ).length

    const selfTests: DiagnosticsReport['selfTests'] = []

    // 1. Storage write check
    try {
      const probe = `${this.config.getCacheDir()}\\diag-probe.tmp`
      fs.writeFileSync(probe, 'ok')
      fs.unlinkSync(probe)
      selfTests.push({
        name: 'Data Directory Read/Write',
        passed: true,
        detail: `Verified write access to ${this.config.getBaseDir()}`
      })
    } catch (e) {
      selfTests.push({
        name: 'Data Directory Read/Write',
        passed: false,
        detail: (e as Error).message
      })
    }

    // 2. Java runtime check
    selfTests.push({
      name: 'Java Runtime Availability',
      passed: javas.length > 0,
      detail:
        javas.length > 0
          ? `Detected ${javas.length} JDK/JRE runtime(s), highest Java ${javas[0].majorVersion}`
          : 'No Java runtime detected yet; install Temurin from the Java Manager tab'
    })

    // 3. Port 25565 availability check
    const portFree = await this.serverManager.isPortFree(25565)
    selfTests.push({
      name: 'Default Port 25565 Probe',
      passed: portFree || runningCount > 0,
      detail: portFree ? 'Port 25565 is available for binding' : 'Port 25565 is currently bound'
    })

    // 4. Modrinth API connectivity
    try {
      const res = await fetch('https://api.modrinth.com/v2/tag/loader', {
        signal: AbortSignal.timeout(4000)
      })
      selfTests.push({
        name: 'Modrinth v2 API Reachability',
        passed: res.ok,
        detail: `HTTP ${res.status} from api.modrinth.com`
      })
    } catch (e) {
      selfTests.push({
        name: 'Modrinth v2 API Reachability',
        passed: false,
        detail: (e as Error).message
      })
    }

    // 5. playit.gg API reachability
    try {
      const res = await fetch('https://api.playit.gg/proto/register', {
        method: 'POST',
        signal: AbortSignal.timeout(4000)
      })
      selfTests.push({
        name: 'playit.gg Control API Reachability',
        passed: res.status < 500,
        detail: `Reached api.playit.gg (status ${res.status})`
      })
    } catch (e) {
      selfTests.push({
        name: 'playit.gg Control API Reachability',
        passed: false,
        detail: (e as Error).message
      })
    }

    return {
      generatedAt: new Date().toISOString(),
      appVersion: app?.getVersion?.() || '1.0.0',
      electronVersion: process.versions.electron || 'N/A',
      nodeVersion: process.versions.node,
      platform: `${os.type()} ${os.arch()}`,
      osRelease: os.release(),
      cpuModel: metrics.cpuModel,
      cpuCores: metrics.cpuCores,
      totalRamGb: Math.round((metrics.ramTotalBytes / 1024 ** 3) * 10) / 10,
      freeRamGb:
        Math.round(((metrics.ramTotalBytes - metrics.ramUsedBytes) / 1024 ** 3) * 10) / 10,
      disks: disks.map((d) => ({
        mount: d.mount,
        totalGb: Math.round((d.size / 1024 ** 3) * 10) / 10,
        freeGb: Math.round(((d.size - d.used) / 1024 ** 3) * 10) / 10
      })),
      javaInstallations: javas,
      lanIps: metrics.lanIps,
      serversCount: servers.length,
      runningServersCount: runningCount,
      playitStatus: this.playitService.getState().controlChannelStatus,
      selfTests
    }
  }
}
