import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { ServerSoftware } from '../../../shared/types'
import { DownloadService } from '../DownloadService'
import { logger } from '../../utils/logger'

const execFileAsync = promisify(execFile)

export interface ProviderVersionList {
  software: ServerSoftware
  versions: string[]
}

export class ServerProviderService {
  constructor(private downloader: DownloadService) {}

  public async getVersions(software: ServerSoftware): Promise<string[]> {
    try {
      switch (software) {
        case 'vanilla':
          return await this.getVanillaVersions()
        case 'paper':
          return await this.getPaperVersions()
        case 'purpur':
          return await this.getPurpurVersions()
        case 'fabric':
          return await this.getFabricVersions()
        case 'quilt':
          return await this.getQuiltVersions()
        case 'forge':
          return await this.getForgeVersions()
        case 'neoforge':
          return await this.getNeoForgeVersions()
      }
    } catch (err) {
      logger.warn(`Failed to fetch live versions for ${software}, returning curated list`, err)
      return ['1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2']
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ChunkHarbor/0.2.2 (MinecraftServerManager)' }
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`)
    }
    return (await res.json()) as T
  }

  // 1. Vanilla (Mojang Piston Meta)
  private async getVanillaVersions(): Promise<string[]> {
    const data = await this.fetchJson<{
      versions: { id: string; type: string; url: string }[]
    }>('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
    return data.versions.filter((v) => v.type === 'release').map((v) => v.id)
  }

  // 2. PaperMC Fill API v3
  private async getPaperVersions(): Promise<string[]> {
    const data = await this.fetchJson<{ versions: Record<string, string[]> }>(
      'https://fill.papermc.io/v3/projects/paper'
    )
    const all = Object.values(data.versions || {}).flat()
    const releases = all.filter((v) => !v.includes('-'))
    return releases.length > 0 ? releases : all
  }

  // 3. PurpurMC API v2
  private async getPurpurVersions(): Promise<string[]> {
    const data = await this.fetchJson<{ versions: string[] }>(
      'https://api.purpurmc.org/v2/purpur'
    )
    return [...data.versions].reverse()
  }

  // 4. Fabric Meta API v2
  private async getFabricVersions(): Promise<string[]> {
    const data = await this.fetchJson<{ version: string; stable: boolean }[]>(
      'https://meta.fabricmc.net/v2/versions/game'
    )
    return data.filter((v) => v.stable).map((v) => v.version)
  }

  // 5. Quilt Meta API v3
  private async getQuiltVersions(): Promise<string[]> {
    const data = await this.fetchJson<{ version: string; stable: boolean }[]>(
      'https://meta.quiltmc.org/v3/versions/game'
    )
    return data.filter((v) => v.stable).map((v) => v.version)
  }

  // 6. Forge Promotions
  private async getForgeVersions(): Promise<string[]> {
    const data = await this.fetchJson<{ promos: Record<string, string> }>(
      'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
    )
    const set = new Set<string>()
    for (const key of Object.keys(data.promos)) {
      const mcVer = key.replace(/-(recommended|latest)$/, '')
      if (/^\d+\.\d+/.test(mcVer)) set.add(mcVer)
    }
    return Array.from(set).reverse()
  }

  // 7. NeoForge Maven API
  private async getNeoForgeVersions(): Promise<string[]> {
    const data = await this.fetchJson<{ versions: string[] }>(
      'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
    )
    const mcSet = new Set<string>()
    for (const v of [...data.versions].reverse()) {
      const parts = v.split('.')
      if (parts.length >= 2) {
        const major = parts[0]
        const minor = parts[1]
        const mc = minor === '0' ? `1.${major}` : `1.${major}.${minor}`
        mcSet.add(mc)
      }
    }
    return Array.from(mcSet)
  }

  /**
   * Install the server binary for the chosen software & version into targetDir, returning the executable jar filename (or @args file).
   */
  public async installServerJar(options: {
    software: ServerSoftware
    version: string
    targetDir: string
    javaBin: string
  }): Promise<{ jarFile: string; build?: string }> {
    const { software, version, targetDir, javaBin } = options
    fs.mkdirSync(targetDir, { recursive: true })

    switch (software) {
      case 'vanilla':
        return await this.installVanilla(version, targetDir)
      case 'paper':
        return await this.installPaper(version, targetDir)
      case 'purpur':
        return await this.installPurpur(version, targetDir)
      case 'fabric':
        return await this.installFabric(version, targetDir)
      case 'quilt':
        return await this.installQuilt(version, targetDir, javaBin)
      case 'forge':
        return await this.installForge(version, targetDir, javaBin)
      case 'neoforge':
        return await this.installNeoForge(version, targetDir, javaBin)
    }
  }

  private async installVanilla(version: string, targetDir: string): Promise<{ jarFile: string }> {
    const manifest = await this.fetchJson<{
      versions: { id: string; url: string }[]
    }>('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
    const entry = manifest.versions.find((v) => v.id === version) || manifest.versions[0]
    if (!entry) throw new Error(`Vanilla version ${version} not found`)

    const detail = await this.fetchJson<{
      downloads: { server: { url: string; sha1: string } }
    }>(entry.url)

    const dest = path.join(targetDir, 'server.jar')
    await this.downloader.downloadFile({
      title: `Minecraft Vanilla ${version}`,
      url: detail.downloads.server.url,
      destPath: dest,
      expectedSha1: detail.downloads.server.sha1
    })
    return { jarFile: 'server.jar' }
  }

  private async installPaper(version: string, targetDir: string): Promise<{ jarFile: string; build: string }> {
    const builds = await this.fetchJson<
      Array<{
        id: number
        downloads: {
          'server:default'?: {
            name: string
            checksums?: { sha256?: string }
            url: string
          }
        }
      }>
    >(`https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`)

    const latest = builds?.[0]
    const dl = latest?.downloads?.['server:default']
    if (!latest || !dl?.url) {
      throw new Error(`No Paper builds found for ${version}`)
    }

    const dest = path.join(targetDir, 'server.jar')

    await this.downloader.downloadFile({
      title: `Paper ${version} (Build #${latest.id})`,
      url: dl.url,
      destPath: dest,
      expectedSha256: dl.checksums?.sha256
    })
    return { jarFile: 'server.jar', build: String(latest.id) }
  }

  private async installPurpur(version: string, targetDir: string): Promise<{ jarFile: string; build: string }> {
    const meta = await this.fetchJson<{ builds: { latest: string } }>(
      `https://api.purpurmc.org/v2/purpur/${version}`
    )
    const build = meta.builds.latest
    const url = `https://api.purpurmc.org/v2/purpur/${version}/${build}/download`
    const dest = path.join(targetDir, 'server.jar')

    await this.downloader.downloadFile({
      title: `Purpur ${version} (Build #${build})`,
      url,
      destPath: dest
    })
    return { jarFile: 'server.jar', build }
  }

  private async installFabric(version: string, targetDir: string): Promise<{ jarFile: string; build: string }> {
    const loaders = await this.fetchJson<{ version: string; stable: boolean }[]>(
      'https://meta.fabricmc.net/v2/versions/loader'
    )
    const installers = await this.fetchJson<{ version: string; stable: boolean }[]>(
      'https://meta.fabricmc.net/v2/versions/installer'
    )
    const loader = (loaders.find((l) => l.stable) || loaders[0]).version
    const installer = (installers.find((i) => i.stable) || installers[0]).version

    const url = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loader}/${installer}/server/jar`
    const dest = path.join(targetDir, 'server.jar')

    await this.downloader.downloadFile({
      title: `Fabric ${version} (Loader ${loader})`,
      url,
      destPath: dest
    })
    return { jarFile: 'server.jar', build: loader }
  }

  private async installQuilt(version: string, targetDir: string, javaBin: string): Promise<{ jarFile: string; build: string }> {
    const installers = await this.fetchJson<{ version: string; url: string }[]>(
      'https://meta.quiltmc.org/v3/versions/installer'
    )
    const latestInstaller = installers[0]
    const installerUrl =
      latestInstaller?.url ||
      `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/${latestInstaller.version}/quilt-installer-${latestInstaller.version}.jar`

    const installerJar = path.join(targetDir, 'quilt-installer.jar')
    await this.downloader.downloadFile({
      title: `Quilt Installer ${latestInstaller.version}`,
      url: installerUrl,
      destPath: installerJar
    })

    await execFileAsync(
      javaBin,
      ['-jar', installerJar, 'install', 'server', version, '--download-server', `--install-dir=${targetDir}`],
      { cwd: targetDir, timeout: 180000 }
    )

    const launchJar = fs.existsSync(path.join(targetDir, 'quilt-server-launch.jar'))
      ? 'quilt-server-launch.jar'
      : 'server.jar'
    return { jarFile: launchJar, build: latestInstaller.version }
  }

  private async installForge(version: string, targetDir: string, javaBin: string): Promise<{ jarFile: string; build: string }> {
    const promos = await this.fetchJson<{ promos: Record<string, string> }>(
      'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
    )
    const forgeVer = promos.promos[`${version}-recommended`] || promos.promos[`${version}-latest`]
    if (!forgeVer) throw new Error(`No Forge build found for Minecraft ${version}`)

    const fullVer = `${version}-${forgeVer}`
    const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVer}/forge-${fullVer}-installer.jar`
    const installerJar = path.join(targetDir, 'forge-installer.jar')

    await this.downloader.downloadFile({
      title: `Forge ${fullVer} Installer`,
      url,
      destPath: installerJar
    })

    await execFileAsync(javaBin, ['-jar', installerJar, '--installServer'], {
      cwd: targetDir,
      timeout: 300000
    })

    // Locate either modern Forge 1.17+ @libraries/.../win_args.txt or legacy forge universal jar
    const winArgsRel = `libraries/net/minecraftforge/forge/${fullVer}/win_args.txt`
    if (fs.existsSync(path.join(targetDir, winArgsRel))) {
      return { jarFile: `@${winArgsRel}`, build: forgeVer }
    }
    const files = fs.readdirSync(targetDir)
    const forgeJar = files.find((f) => f.startsWith('forge-') && f.endsWith('.jar') && !f.includes('installer'))
    return { jarFile: forgeJar || 'server.jar', build: forgeVer }
  }

  private async installNeoForge(version: string, targetDir: string, javaBin: string): Promise<{ jarFile: string; build: string }> {
    const data = await this.fetchJson<{ versions: string[] }>(
      'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
    )
    const prefix = version.startsWith('1.') ? version.slice(2) + '.' : version
    const matching = [...data.versions].reverse().find((v) => v.startsWith(prefix)) || data.versions[data.versions.length - 1]
    if (!matching) throw new Error(`No NeoForge version found for ${version}`)

    const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${matching}/neoforge-${matching}-installer.jar`
    const installerJar = path.join(targetDir, 'neoforge-installer.jar')

    await this.downloader.downloadFile({
      title: `NeoForge ${matching} Installer`,
      url,
      destPath: installerJar
    })

    await execFileAsync(javaBin, ['-jar', installerJar, '--installServer'], {
      cwd: targetDir,
      timeout: 300000
    })

    return { jarFile: `@libraries/net/neoforged/neoforge/${matching}/win_args.txt`, build: matching }
  }
}
