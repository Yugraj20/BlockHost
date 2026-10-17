import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { FileNode, WorldInfo } from '../../shared/types'
import { ConfigService } from './ConfigService'
import { ServerManager } from './ServerManager'
import { ZipService } from './ZipService'
import { resolveSafePath, getDirectorySize } from '../utils/security'

export class FileService {
  constructor(
    private config: ConfigService,
    private serverManager?: ServerManager
  ) {}

  private getServerRoot(serverId: string): string {
    const srv = this.config.getServer(serverId)
    if (!srv) throw new Error(`Server not found: ${serverId}`)
    return srv.directory
  }

  public listDirectory(serverId: string, relDir = ''): FileNode[] {
    const root = this.getServerRoot(serverId)
    const target = resolveSafePath(root, relDir)
    if (!fs.existsSync(target)) return []

    const entries = fs.readdirSync(target, { withFileTypes: true })
    const nodes: FileNode[] = entries.map((e) => {
      const full = path.join(target, e.name)
      const rel = path.relative(root, full).replace(/\\/g, '/')
      let size = 0
      let modifiedAt = Date.now()
      try {
        const st = fs.statSync(full)
        size = e.isDirectory() ? 0 : st.size
        modifiedAt = st.mtimeMs
      } catch {
        // ignore
      }
      return {
        name: e.name,
        path: rel,
        isDirectory: e.isDirectory(),
        size,
        modifiedAt,
        extension: e.isDirectory() ? '' : path.extname(e.name).toLowerCase()
      }
    })

    return nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  public readTextFile(serverId: string, relPath: string): string {
    const root = this.getServerRoot(serverId)
    const full = resolveSafePath(root, relPath)
    if (!fs.existsSync(full)) throw new Error('File does not exist')

    if (full.endsWith('.gz')) {
      const compressed = fs.readFileSync(full)
      return zlib.gunzipSync(compressed).toString('utf-8')
    }

    return fs.readFileSync(full, 'utf-8')
  }

  public writeTextFile(serverId: string, relPath: string, content: string): void {
    const root = this.getServerRoot(serverId)
    const full = resolveSafePath(root, relPath)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    if (fs.existsSync(full)) {
      fs.copyFileSync(full, `${full}.bak`)
    }
    fs.writeFileSync(full, content, 'utf-8')
  }

  public createDirectory(serverId: string, relPath: string): void {
    const root = this.getServerRoot(serverId)
    const full = resolveSafePath(root, relPath)
    fs.mkdirSync(full, { recursive: true })
  }

  public renameEntry(serverId: string, oldRelPath: string, newName: string): void {
    const root = this.getServerRoot(serverId)
    const oldFull = resolveSafePath(root, oldRelPath)
    const newFull = resolveSafePath(path.dirname(oldFull), path.basename(newName))
    fs.renameSync(oldFull, newFull)
  }

  public deleteEntry(serverId: string, relPath: string): void {
    const root = this.getServerRoot(serverId)
    const full = resolveSafePath(root, relPath)
    if (full === path.resolve(root)) {
      throw new Error('Cannot delete root server directory')
    }
    fs.rmSync(full, { recursive: true, force: true })
  }

  public copyExternalFileToServer(serverId: string, externalFilePath: string, destRelDir = ''): void {
    const root = this.getServerRoot(serverId)
    const targetDir = resolveSafePath(root, destRelDir)
    fs.mkdirSync(targetDir, { recursive: true })
    const dest = resolveSafePath(targetDir, path.basename(externalFilePath))
    fs.copyFileSync(externalFilePath, dest)
  }

  public async extractArchiveInServer(serverId: string, relZipPath: string, relTargetDir = ''): Promise<void> {
    const root = this.getServerRoot(serverId)
    const zipFull = resolveSafePath(root, relZipPath)
    const destDir = resolveSafePath(root, relTargetDir || path.dirname(relZipPath))
    await ZipService.extractZip(zipFull, destDir)
  }

  public async compressEntriesInServer(
    serverId: string,
    relPaths: string[],
    outputRelZipPath: string
  ): Promise<void> {
    const root = this.getServerRoot(serverId)
    const outFull = resolveSafePath(root, outputRelZipPath)
    await ZipService.createZip(root, outFull, relPaths)
  }

  /**
   * List server log files (`logs/latest.log` and compressed `.log.gz` files).
   */
  public listLogFiles(serverId: string): { name: string; relPath: string; size: number; modifiedAt: number }[] {
    const root = this.getServerRoot(serverId)
    const logsDir = path.join(root, 'logs')
    if (!fs.existsSync(logsDir)) return []

    return fs
      .readdirSync(logsDir)
      .filter((f) => f.endsWith('.log') || f.endsWith('.log.gz'))
      .map((f) => {
        const st = fs.statSync(path.join(logsDir, f))
        return {
          name: f,
          relPath: `logs/${f}`,
          size: st.size,
          modifiedAt: st.mtimeMs
        }
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
  }

  /**
   * World Management: discover worlds and dimensions inside the server folder.
   */
  public listWorlds(serverId: string): WorldInfo[] {
    const srv = this.config.getServer(serverId)
    if (!srv || !fs.existsSync(srv.directory)) return []

    const entries = fs.readdirSync(srv.directory, { withFileTypes: true })
    const worlds: WorldInfo[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const folderPath = path.join(srv.directory, entry.name)
      const hasLevelDat = fs.existsSync(path.join(folderPath, 'level.dat'))
      const hasRegion =
        fs.existsSync(path.join(folderPath, 'region')) ||
        fs.existsSync(path.join(folderPath, 'DIM-1')) ||
        fs.existsSync(path.join(folderPath, 'DIM1'))

      if (hasLevelDat || hasRegion || entry.name === srv.levelName) {
        let dimension: WorldInfo['dimension'] = 'overworld'
        if (entry.name.endsWith('_nether')) dimension = 'nether'
        else if (entry.name.endsWith('_the_end')) dimension = 'the_end'

        let lastPlayed: number | undefined
        try {
          lastPlayed = fs.statSync(path.join(folderPath, 'level.dat')).mtimeMs
        } catch {
          // ignore
        }

        worlds.push({
          name: entry.name,
          folderName: entry.name,
          dimension,
          sizeBytes: getDirectorySize(folderPath),
          isActive: entry.name === srv.levelName || entry.name.startsWith(`${srv.levelName}_`),
          lastPlayed
        })
      }
    }

    if (worlds.length === 0) {
      worlds.push({
        name: srv.levelName,
        folderName: srv.levelName,
        dimension: 'overworld',
        sizeBytes: 0,
        isActive: true
      })
    }

    return worlds
  }

  public async resetWorld(serverId: string, folderName: string): Promise<void> {
    if (this.serverManager) {
      const state = this.serverManager.getRuntimeState(serverId)
      if (state.status !== 'offline') {
        await this.serverManager.stopServer(serverId)
      }
    }
    const root = this.getServerRoot(serverId)
    const target = resolveSafePath(root, folderName)
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true })
    }
    fs.mkdirSync(target, { recursive: true })
  }

  public async exportWorldZip(serverId: string, folderName: string, destZipPath: string): Promise<void> {
    const isOnline = this.serverManager?.getRuntimeState(serverId)?.status === 'online'
    if (isOnline && this.serverManager) {
      this.serverManager.sendCommand(serverId, 'save-off')
      this.serverManager.sendCommand(serverId, 'save-all flush')
      await new Promise((r) => setTimeout(r, 1000))
    }
    try {
      const root = this.getServerRoot(serverId)
      const worldDir = resolveSafePath(root, folderName)
      await ZipService.createZip(worldDir, destZipPath)
    } finally {
      if (isOnline && this.serverManager) {
        this.serverManager.sendCommand(serverId, 'save-on')
      }
    }
  }

  public async importWorldZip(serverId: string, sourceZipPath: string, folderName: string): Promise<void> {
    if (this.serverManager) {
      const state = this.serverManager.getRuntimeState(serverId)
      if (state.status !== 'offline') {
        await this.serverManager.stopServer(serverId)
      }
    }
    const root = this.getServerRoot(serverId)
    const worldDir = resolveSafePath(root, folderName)
    if (fs.existsSync(worldDir)) {
      fs.rmSync(worldDir, { recursive: true, force: true })
    }
    await ZipService.extractZip(sourceZipPath, worldDir)
  }
}
