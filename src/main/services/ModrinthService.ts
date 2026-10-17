import fs from 'fs'
import path from 'path'
import {
  ModrinthProject,
  ModrinthVersion,
  InstalledAddon,
  ServerConfig
} from '../../shared/types'
import { ConfigService } from './ConfigService'
import { DownloadService } from './DownloadService'
import { ZipService } from './ZipService'
import { resolveSafePath } from '../utils/security'
import { logger } from '../utils/logger'

export class ModrinthService {
  private apiBase = 'https://api.modrinth.com/v2'

  constructor(
    private config: ConfigService,
    private downloader: DownloadService
  ) {}

  private async fetchApi<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${this.apiBase}${endpoint}`, {
      headers: {
        'User-Agent': 'BlockHost/1.0.0 (MinecraftServerManager; contact@blockhost.local)'
      }
    })
    if (!res.ok) {
      throw new Error(`Modrinth API returned HTTP ${res.status} for ${endpoint}`)
    }
    return (await res.json()) as T
  }

  /**
   * Search Modrinth for mods, plugins, modpacks, or datapacks filtered by game version and loader.
   */
  public async searchProjects(params: {
    query: string
    projectType: 'mod' | 'plugin' | 'modpack' | 'datapack'
    gameVersion?: string
    loader?: string
    limit?: number
  }): Promise<ModrinthProject[]> {
    const facets: string[][] = []

    if (params.projectType === 'plugin') {
      facets.push(['project_type:mod', 'project_type:plugin'])
      facets.push(['categories:paper', 'categories:purpur', 'categories:spigot', 'categories:bukkit'])
    } else if (params.projectType === 'datapack') {
      facets.push(['project_type:datapack'])
    } else {
      facets.push([`project_type:${params.projectType}`])
      if (params.loader && params.projectType === 'mod') {
        facets.push([`categories:${params.loader}`])
      }
    }

    if (params.gameVersion) {
      facets.push([`versions:${params.gameVersion}`])
    }

    const q = new URLSearchParams({
      query: params.query || '',
      limit: String(params.limit || 24),
      index: 'relevance',
      facets: JSON.stringify(facets)
    })

    const data = await this.fetchApi<{ hits: ModrinthProject[] }>(`/search?${q.toString()}`)
    return data.hits
  }

  public async getProjectVersions(
    projectId: string,
    gameVersion?: string,
    loader?: string
  ): Promise<ModrinthVersion[]> {
    const q = new URLSearchParams()
    if (gameVersion) q.set('game_versions', JSON.stringify([gameVersion]))
    if (loader && loader !== 'vanilla') {
      const loaders = loader === 'paper' || loader === 'purpur' ? ['paper', 'purpur', 'spigot', 'bukkit'] : [loader]
      q.set('loaders', JSON.stringify(loaders))
    }
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return await this.fetchApi<ModrinthVersion[]>(`/project/${projectId}/version${suffix}`)
  }

  /**
   * Install a Mod, Plugin, or Datapack from Modrinth into the server,
   * automatically resolving and installing required dependencies.
   */
  public async installAddon(options: {
    serverId: string
    projectId: string
    versionId?: string
    type?: 'mod' | 'plugin' | 'datapack'
    visited?: Set<string>
  }): Promise<InstalledAddon> {
    const srv = this.config.getServer(options.serverId)
    if (!srv) throw new Error('Server not found')

    const visited = options.visited || new Set<string>()
    visited.add(options.projectId)

    const isPluginServer = srv.software === 'paper' || srv.software === 'purpur'
    const isDatapack = options.type === 'datapack'
    const resolvedType = isDatapack ? 'datapack' : (options.type || (isPluginServer ? 'plugin' : 'mod'))
    const folderName = isDatapack
      ? path.join(srv.levelName || 'world', 'datapacks')
      : resolvedType === 'plugin'
        ? 'plugins'
        : 'mods'
    const targetDir = path.join(srv.directory, folderName)
    fs.mkdirSync(targetDir, { recursive: true })

    let version: ModrinthVersion | undefined
    if (options.versionId) {
      version = await this.fetchApi<ModrinthVersion>(`/version/${options.versionId}`)
    } else {
      const versions = await this.getProjectVersions(
        options.projectId,
        srv.version,
        isDatapack ? undefined : srv.software
      )
      version = versions[0]
      if (!version) {
        const allVersions = await this.getProjectVersions(options.projectId)
        version = allVersions[0]
      }
    }

    if (!version || version.files.length === 0) {
      throw new Error(`No compatible files found on Modrinth for project ${options.projectId}`)
    }

    // Install required dependencies first
    for (const dep of version.dependencies || []) {
      if (dep.dependency_type === 'required' && dep.project_id && !visited.has(dep.project_id)) {
        try {
          await this.installAddon({
            serverId: srv.id,
            projectId: dep.project_id,
            versionId: dep.version_id,
            visited
          })
        } catch (err) {
          logger.warn(`Failed to install optional/required dependency ${dep.project_id}`, err)
        }
      }
    }

    const file = version.files.find((f) => f.primary) || version.files[0]
    const destPath = resolveSafePath(targetDir, file.filename)

    await this.downloader.downloadFile({
      title: `${version.name} (${file.filename})`,
      url: file.url,
      destPath,
      expectedSha1: file.hashes?.sha1
    })

    // Save sidecar metadata for update checking
    this.saveAddonMeta(srv, file.filename, {
      projectId: options.projectId,
      versionId: version.id,
      name: version.name,
      versionNumber: version.version_number
    })

    this.config.addActivity({
      serverId: srv.id,
      serverName: srv.name,
      type: 'mod_install',
      title: `Installed ${version.name}`,
      subtitle: `${folderName}/${file.filename} on ${srv.name}`
    })

    return {
      filename: file.filename,
      name: version.name,
      version: version.version_number,
      type: resolvedType,
      enabled: true,
      size: file.size,
      projectId: options.projectId,
      versionId: version.id
    }
  }

  /**
   * Install a Modrinth `.mrpack` Modpack (server-side files + overrides + server-overrides).
   */
  public async installModpack(options: {
    serverId: string
    projectId: string
    versionId?: string
  }): Promise<{ installedFiles: number; packName: string }> {
    const srv = this.config.getServer(options.serverId)
    if (!srv) throw new Error('Server not found')

    const versions = options.versionId
      ? [await this.fetchApi<ModrinthVersion>(`/version/${options.versionId}`)]
      : await this.getProjectVersions(options.projectId)

    const version = versions[0]
    if (!version || version.files.length === 0) {
      throw new Error('No modpack version found')
    }

    const mrpackFile = version.files.find((f) => f.filename.endsWith('.mrpack')) || version.files[0]
    const tempPackPath = path.join(this.config.getCacheDir(), mrpackFile.filename)
    const extractDir = path.join(this.config.getCacheDir(), `mrpack-${Date.now()}`)

    await this.downloader.downloadFile({
      title: `Modpack ${version.name}`,
      url: mrpackFile.url,
      destPath: tempPackPath,
      expectedSha1: mrpackFile.hashes?.sha1
    })

    await ZipService.extractZip(tempPackPath, extractDir)

    const indexPath = path.join(extractDir, 'modrinth.index.json')
    let count = 0
    let packName = version.name

    if (fs.existsSync(indexPath)) {
      const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as {
        name: string
        dependencies: Record<string, string>
        files: {
          path: string
          hashes: { sha1: string }
          env?: { client: string; server: string }
          downloads: string[]
        }[]
      }
      packName = indexData.name || packName

      for (const entry of indexData.files) {
        if (entry.env?.server === 'unsupported') continue
        const dlUrl = entry.downloads[0]
        if (!dlUrl) continue
        const dest = resolveSafePath(srv.directory, entry.path)
        await this.downloader.downloadFile({
          title: `${packName}: ${path.basename(entry.path)}`,
          url: dlUrl,
          destPath: dest,
          expectedSha1: entry.hashes?.sha1
        })
        count++
      }
    }

    // Copy overrides and server-overrides into server root
    for (const overrideFolder of ['overrides', 'server-overrides']) {
      const fullOverride = path.join(extractDir, overrideFolder)
      if (fs.existsSync(fullOverride)) {
        fs.cpSync(fullOverride, srv.directory, { recursive: true })
      }
    }

    fs.rmSync(extractDir, { recursive: true, force: true })

    this.config.addActivity({
      serverId: srv.id,
      serverName: srv.name,
      type: 'mod_install',
      title: `Modpack installed: ${packName}`,
      subtitle: `${count} server files deployed to ${srv.name}`
    })

    return { installedFiles: count, packName }
  }

  private getMetaFilePath(srv: ServerConfig): string {
    return path.join(srv.directory, '.blockhost-addons.json')
  }

  private readAddonMetaMap(
    srv: ServerConfig
  ): Record<string, { projectId: string; versionId: string; name: string; versionNumber: string }> {
    const file = this.getMetaFilePath(srv)
    if (!fs.existsSync(file)) return {}
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    } catch {
      return {}
    }
  }

  private saveAddonMeta(
    srv: ServerConfig,
    filename: string,
    meta: { projectId: string; versionId: string; name: string; versionNumber: string }
  ): void {
    const map = this.readAddonMetaMap(srv)
    map[filename] = meta
    fs.writeFileSync(this.getMetaFilePath(srv), JSON.stringify(map, null, 2))
  }

  /**
   * List installed mods, plugins, and datapacks for a server.
   */
  public listInstalledAddons(serverId: string): InstalledAddon[] {
    const srv = this.config.getServer(serverId)
    if (!srv) return []

    const metaMap = this.readAddonMetaMap(srv)
    const out: InstalledAddon[] = []

    const scanFolder = (relFolder: string, type: 'mod' | 'plugin' | 'datapack') => {
      const dir = path.join(srv.directory, relFolder)
      if (!fs.existsSync(dir)) return
      for (const file of fs.readdirSync(dir)) {
        const isJar = file.endsWith('.jar') || file.endsWith('.jar.disabled')
        const isZip = file.endsWith('.zip') || file.endsWith('.zip.disabled')
        if (type !== 'datapack' && !isJar) continue
        if (type === 'datapack' && !isZip && !fs.statSync(path.join(dir, file)).isDirectory()) continue

        const enabled = !file.endsWith('.disabled')
        const cleanName = file.replace(/\.disabled$/, '')
        const meta = metaMap[cleanName]
        const stat = fs.statSync(path.join(dir, file))

        out.push({
          filename: file,
          name: meta?.name || cleanName.replace(/\.(jar|zip)$/, ''),
          version: meta?.versionNumber || 'installed',
          type,
          enabled,
          size: stat.size,
          projectId: meta?.projectId,
          versionId: meta?.versionId
        })
      }
    }

    scanFolder('mods', 'mod')
    scanFolder('plugins', 'plugin')
    scanFolder(path.join(srv.levelName || 'world', 'datapacks'), 'datapack')
    return out
  }

  /**
   * Enable or disable an installed mod/plugin/datapack by toggling the `.disabled` suffix.
   */
  public toggleAddon(
    serverId: string,
    filename: string,
    type: 'mod' | 'plugin' | 'datapack'
  ): InstalledAddon[] {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error('Server not found')
    const relFolder =
      type === 'datapack'
        ? path.join(srv.levelName || 'world', 'datapacks')
        : type === 'plugin'
          ? 'plugins'
          : 'mods'
    const dir = path.join(srv.directory, relFolder)
    const currentPath = resolveSafePath(dir, filename)
    if (!fs.existsSync(currentPath)) throw new Error('Addon file not found')

    const nextName = filename.endsWith('.disabled')
      ? filename.replace(/\.disabled$/, '')
      : `${filename}.disabled`

    fs.renameSync(currentPath, resolveSafePath(dir, nextName))
    return this.listInstalledAddons(serverId)
  }

  public deleteAddon(
    serverId: string,
    filename: string,
    type: 'mod' | 'plugin' | 'datapack'
  ): InstalledAddon[] {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error('Server not found')
    const relFolder =
      type === 'datapack'
        ? path.join(srv.levelName || 'world', 'datapacks')
        : type === 'plugin'
          ? 'plugins'
          : 'mods'
    const target = resolveSafePath(path.join(srv.directory, relFolder), filename)
    if (fs.existsSync(target)) {
      if (fs.statSync(target).isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true })
      } else {
        fs.unlinkSync(target)
      }
    }
    const map = this.readAddonMetaMap(srv)
    const baseName = filename.replace(/\.disabled$/, '')
    delete map[filename]
    delete map[baseName]
    delete map[`${baseName}.disabled`]
    try {
      fs.writeFileSync(this.getMetaFilePath(srv), JSON.stringify(map, null, 2))
    } catch {
      // ignore write error if directory removed
    }
    return this.listInstalledAddons(serverId)
  }

  /**
   * Check Modrinth for newer versions of installed mods/plugins.
   */
  public async checkForAddonUpdates(serverId: string): Promise<InstalledAddon[]> {
    const srv = this.config.getServer(serverId)
    if (!srv) return []
    const addons = this.listInstalledAddons(serverId)

    for (const addon of addons) {
      if (!addon.projectId) continue
      try {
        const versions = await this.getProjectVersions(addon.projectId, srv.version, srv.software)
        const latest = versions[0]
        if (latest && addon.versionId && latest.id !== addon.versionId) {
          addon.updateAvailable = latest
        }
      } catch {
        // ignore network hiccup per mod
      }
    }
    return addons
  }
}
