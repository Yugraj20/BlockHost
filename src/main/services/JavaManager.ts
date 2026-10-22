import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { JavaInstallation } from '../../shared/types'
import { ConfigService } from './ConfigService'
import { DownloadService } from './DownloadService'
import { ZipService } from './ZipService'
import { logger } from '../utils/logger'

const execFileAsync = promisify(execFile)

export class JavaManager {
  constructor(
    private config: ConfigService,
    private downloader: DownloadService
  ) {}

  /**
   * Determine the recommended Java major version for a given Minecraft version.
   */
  public static getRequiredJavaVersion(mcVersion: string): number {
    const parts = mcVersion.match(/\d+/g)?.map(Number) ?? []
    if (parts.length === 0) return 21

    // Minecraft switched from 1.x numbering to year-based versions (26.1+).
    // Those releases require Java 25; don't treat the second component as the
    // old Minecraft minor version (which incorrectly made 26.3 require Java 8).
    if (parts[0] >= 26) return 25

    const minor = parts[0] === 1 ? (parts[1] ?? 20) : parts[0]
    const patch = parts[0] === 1 ? (parts[2] ?? 0) : (parts[1] ?? 0)

    if (minor >= 21 || (minor === 20 && patch >= 5)) {
      return 21
    }
    if (minor >= 18) {
      return 17
    }
    if (minor === 17) {
      return 17
    }
    return 8
  }

  /**
   * Detect system and ChunkHarbor-managed Java installations.
   */
  public async detectInstallations(): Promise<JavaInstallation[]> {
    const candidates = new Set<string>()

    // 1. Managed Java installations
    const javaDir = this.config.getSettings().javaDir
    if (fs.existsSync(javaDir)) {
      for (const dir of fs.readdirSync(javaDir)) {
        const directBin = path.join(javaDir, dir, 'bin', 'java.exe')
        if (fs.existsSync(directBin)) candidates.add(directBin)
        const subDir = path.join(javaDir, dir)
        if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
          for (const inner of fs.readdirSync(subDir)) {
            const nestedBin = path.join(subDir, inner, 'bin', 'java.exe')
            if (fs.existsSync(nestedBin)) candidates.add(nestedBin)
          }
        }
      }
    }

    // 2. Common Windows JDK locations
    const roots = [
      process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java.exe') : '',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Microsoft',
      'C:\\Program Files\\Zulu',
      'C:\\Program Files\\BellSoft'
    ].filter(Boolean)

    for (const root of roots) {
      if (root.endsWith('java.exe') && fs.existsSync(root)) {
        candidates.add(root)
      } else if (fs.existsSync(root) && fs.statSync(root).isDirectory()) {
        for (const sub of fs.readdirSync(root)) {
          const bin = path.join(root, sub, 'bin', 'java.exe')
          if (fs.existsSync(bin)) candidates.add(bin)
        }
      }
    }

    // 3. `where java` on PATH
    try {
      const { stdout } = await execFileAsync('where', ['java'])
      stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.endsWith('.exe') && fs.existsSync(s))
        .forEach((s) => candidates.add(s))
    } catch {
      // ignore if not on PATH
    }

    const installations: JavaInstallation[] = []
    for (const javaExe of candidates) {
      const info = await this.probeJavaBinary(javaExe)
      if (info) installations.push(info)
    }

    return installations.sort((a, b) => b.majorVersion - a.majorVersion)
  }

  private async probeJavaBinary(javaExe: string): Promise<JavaInstallation | null> {
    try {
      const { stderr, stdout } = await execFileAsync(javaExe, ['-version'], { timeout: 5000 })
      const output = `${stderr}\n${stdout}`
      const versionMatch = output.match(/version\s+"([^"]+)"/i)
      if (!versionMatch) return null
      const versionStr = versionMatch[1]
      let major = 8
      if (versionStr.startsWith('1.')) {
        major = parseInt(versionStr.split('.')[1], 10)
      } else {
        major = parseInt(versionStr.split('.')[0], 10)
      }

      const vendor = output.includes('Temurin')
        ? 'Eclipse Temurin'
        : output.includes('OpenJDK')
          ? 'OpenJDK'
          : 'Oracle/Java'

      const managed = javaExe.toLowerCase().startsWith(this.config.getSettings().javaDir.toLowerCase())

      return {
        version: versionStr,
        majorVersion: major,
        vendor,
        path: javaExe,
        arch: output.includes('64-Bit') ? 'x64' : 'x86',
        managed
      }
    } catch {
      return null
    }
  }

  /**
   * Download and install an Eclipse Temurin JDK runtime (8, 17, 21, or 25) from the official Adoptium API.
   */
  public async installTemurin(majorVersion: 8 | 17 | 21 | 25): Promise<JavaInstallation> {
    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse`
    logger.info(`Fetching Adoptium metadata for Temurin ${majorVersion}: ${apiUrl}`)

    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'ChunkHarbor/1.0.0' }
    })
    if (!res.ok) {
      throw new Error(`Adoptium API returned HTTP ${res.status} for Java ${majorVersion}`)
    }

    const assets = (await res.json()) as Array<{
      binary?: { package?: { link: string; checksum: string; name: string } }
    }>

    const pkg = assets?.[0]?.binary?.package
    if (!pkg?.link) {
      throw new Error(`No Windows x64 JRE package found for Java ${majorVersion}`)
    }

    const zipDest = path.join(this.config.getCacheDir(), pkg.name || `temurin-${majorVersion}.zip`)
    await this.downloader.downloadFile({
      title: `Eclipse Temurin JRE ${majorVersion}`,
      url: pkg.link,
      destPath: zipDest,
      expectedSha256: pkg.checksum
    })

    const targetFolder = path.join(this.config.getSettings().javaDir, `temurin-${majorVersion}`)
    if (fs.existsSync(targetFolder)) {
      fs.rmSync(targetFolder, { recursive: true, force: true })
    }

    await ZipService.extractZip(zipDest, targetFolder)
    const all = await this.detectInstallations()
    const found = all.find((j) => j.majorVersion === majorVersion && j.managed) || all[0]
    if (!found) {
      throw new Error(`Installed Temurin ${majorVersion}, but could not locate java.exe`)
    }
    return found
  }

  /**
   * Pick the best available Java binary for a given Minecraft version.
   */
  public async resolveJavaForServer(mcVersion: string, preferredPath?: string): Promise<string> {
    if (preferredPath && preferredPath !== 'auto' && fs.existsSync(preferredPath)) {
      return preferredPath
    }

    const requiredMajor = JavaManager.getRequiredJavaVersion(mcVersion) as 8 | 17 | 21 | 25
    const installed = await this.detectInstallations()

    // Exact match first, otherwise any compatible higher version
    const exact = installed.find((j) => j.majorVersion === requiredMajor)
    if (exact) return exact.path

    const compatible = installed.find((j) => j.majorVersion >= requiredMajor)
    if (compatible) return compatible.path

    // Automatically download & provision matching Eclipse Temurin JRE if no compatible version is found
    try {
      logger.info(`No compatible Java ${requiredMajor} found on system. Automatically installing Eclipse Temurin JRE ${requiredMajor}...`)
      const autoInstalled = await this.installTemurin(requiredMajor)
      if (autoInstalled?.path) return autoInstalled.path
    } catch (err) {
      logger.warn(`Automatic Temurin installation failed (${(err as Error).message}), falling back to PATH java`)
    }

    // If none found and auto-install failed, fallback to first installed or system 'java'
    if (installed.length > 0) return installed[0].path
    return 'java'
  }
}
