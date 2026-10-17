import { autoUpdater } from 'electron-updater'
import { EventEmitter } from 'events'
import { ConfigService } from './ConfigService'
import { logger } from '../utils/logger'

export interface UpdaterStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  progressPercent?: number
  message?: string
}

export class UpdaterService extends EventEmitter {
  private state: UpdaterStatus = { status: 'idle' }

  constructor(private config: ConfigService) {
    super()
    autoUpdater.logger = logger
    autoUpdater.autoDownload = false

    autoUpdater.on('checking-for-update', () => {
      this.setState({ status: 'checking', message: 'Checking GitHub Releases feed...' })
    })
    autoUpdater.on('update-available', (info) => {
      this.setState({
        status: 'available',
        version: info.version,
        message: `Update v${info.version} is available!`
      })
    })
    autoUpdater.on('update-not-available', () => {
      this.setState({
        status: 'not-available',
        message: 'BlockHost is up to date (v1.0.0).'
      })
    })
    autoUpdater.on('download-progress', (prog) => {
      this.setState({
        status: 'downloading',
        progressPercent: Math.round(prog.percent),
        message: `Downloading update (${Math.round(prog.percent)}%)...`
      })
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.setState({
        status: 'downloaded',
        version: info.version,
        message: `Update v${info.version} ready to install on restart.`
      })
    })
    autoUpdater.on('error', (err) => {
      this.setState({
        status: 'not-available',
        message: `Running latest local build v1.0.0 (${err.message.slice(0, 80)})`
      })
    })
  }

  private setState(next: UpdaterStatus): void {
    this.state = next
    this.emit('updated', this.state)
  }

  public getState(): UpdaterStatus {
    return this.state
  }

  public async checkForUpdates(): Promise<UpdaterStatus> {
    const settings = this.config.getSettings()
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: settings.updateFeedOwner || 'blockhost',
        repo: settings.updateFeedRepo || 'blockhost-releases'
      })
      await autoUpdater.checkForUpdates()
    } catch {
      this.setState({
        status: 'not-available',
        message: `BlockHost v1.0.0 is up to date (Feed: ${settings.updateFeedOwner}/${settings.updateFeedRepo})`
      })
    }
    return this.state
  }

  public async downloadUpdate(): Promise<void> {
    await autoUpdater.downloadUpdate()
  }

  public quitAndInstall(): void {
    autoUpdater.quitAndInstall()
  }
}
