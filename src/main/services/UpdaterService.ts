import { app } from 'electron'
import { EventEmitter } from 'events'
import { ConfigService } from './ConfigService'
import { logger } from '../utils/logger'

export interface UpdaterStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseName?: string
  progressPercent?: number
  message?: string
  downloadUrl?: string
  releaseNotes?: string
  isForced?: boolean
}

export class UpdaterService extends EventEmitter {
  private state: UpdaterStatus = { status: 'idle' }

  constructor(private config: ConfigService) {
    super()
  }

  private setState(next: UpdaterStatus): void {
    this.state = next
    this.emit('updated', this.state)
  }

  public getState(): UpdaterStatus {
    return this.state
  }

  public isNewerVersion(remoteTag: string, localVersion: string): boolean {
    const cleanRemote = remoteTag.replace(/^v/, '').trim()
    const cleanLocal = localVersion.replace(/^v/, '').trim()
    if (cleanRemote === cleanLocal) return false

    const [rBase, rPre] = cleanRemote.split('-')
    const [lBase, lPre] = cleanLocal.split('-')

    const rParts = rBase.split('.').map((n) => parseInt(n, 10) || 0)
    const lParts = lBase.split('.').map((n) => parseInt(n, 10) || 0)

    for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
      const r = rParts[i] || 0
      const l = lParts[i] || 0
      if (r > l) return true
      if (r < l) return false
    }

    if (!rPre && lPre) return true
    if (rPre && !lPre) return false
    if (rPre && lPre && rPre !== lPre) {
      return cleanRemote.localeCompare(cleanLocal, undefined, { numeric: true }) > 0
    }

    return false
  }

  public async checkForUpdates(silent = false): Promise<UpdaterStatus> {
    const settings = this.config.getSettings()
    let owner = settings.updateFeedOwner || 'Yugraj20'
    let repo = settings.updateFeedRepo || 'BlockHost'
    if (owner === 'blockhost') owner = 'Yugraj20'
    if (repo === 'blockhost-releases') repo = 'BlockHost'

    const currentVersion = app?.getVersion?.() || '0.2.0-beta'

    if (!silent) {
      this.setState({ status: 'checking', message: `Checking ${owner}/${repo} for updates...` })
    }

    try {
      logger.info(
        `[Updater] Querying GitHub releases: https://api.github.com/repos/${owner}/${repo}/releases/latest`
      )
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
        headers: {
          'User-Agent': 'BlockHost-Desktop-App',
          Accept: 'application/vnd.github+json'
        }
      })

      if (!res.ok) {
        logger.warn(`[Updater] GitHub API returned HTTP ${res.status}: ${res.statusText}`)
        if (!silent) {
          this.setState({
            status: 'not-available',
            message: `BlockHost v${currentVersion} is up to date.`
          })
        }
        return this.state
      }

      const release = (await res.json()) as {
        tag_name?: string
        name?: string
        body?: string
        html_url?: string
        assets?: Array<{ name: string; browser_download_url: string }>
      }

      const remoteTag = release.tag_name || ''
      logger.info(`[Updater] Remote tag: "${remoteTag}", current local: "v${currentVersion}"`)

      if (remoteTag && this.isNewerVersion(remoteTag, currentVersion)) {
        const exeAsset = release.assets?.find((a) => a.name.endsWith('.exe'))
        const downloadUrl =
          exeAsset?.browser_download_url ||
          release.html_url ||
          `https://github.com/${owner}/${repo}/releases/latest`

        logger.info(`[Updater] Forced update available: ${remoteTag}. Download URL: ${downloadUrl}`)

        this.setState({
          status: 'available',
          version: remoteTag,
          releaseName: release.name || remoteTag,
          message: `Update ${remoteTag} is available!`,
          downloadUrl,
          releaseNotes: release.body || '',
          isForced: true
        })
      } else {
        logger.info(`[Updater] App is up to date (Local: v${currentVersion}, Remote: ${remoteTag})`)
        if (!silent) {
          this.setState({
            status: 'not-available',
            message: `BlockHost v${currentVersion} is the latest version.`
          })
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[Updater] Failed to check for updates:', err)
      if (!silent) {
        this.setState({
          status: 'error',
          message: `Update check failed: ${msg.slice(0, 80)}`
        })
      }
    }

    return this.state
  }

  public async downloadUpdate(): Promise<void> {
    // In forced update mode, downloading is triggered directly in browser
  }

  public quitAndInstall(): void {
    // Graceful exit
    app.quit()
  }
}
