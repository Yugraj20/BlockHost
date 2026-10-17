import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { ConfigService } from './ConfigService'
import { ServerManager } from './ServerManager'

export class TrayService {
  private tray: Tray | null = null

  constructor(
    private config: ConfigService,
    private serverManager: ServerManager,
    private getMainWindow: () => BrowserWindow | null,
    private onQuitRequested: () => void
  ) {}

  public init(): void {
    const iconCandidates = [
      path.join(process.resourcesPath, 'resources', 'tray.png'),
      path.resolve('resources/tray.png'),
      path.resolve('build/icon.png')
    ]
    const iconPath = iconCandidates.find((p) => fs.existsSync(p))
    const image = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()

    this.tray = new Tray(image)
    this.tray.setToolTip('BlockHost - Minecraft Server Hosting')
    this.tray.on('double-click', () => {
      const win = this.getMainWindow()
      if (win) {
        win.show()
        win.focus()
      }
    })

    this.rebuildMenu()
    this.serverManager.on('state:updated', () => this.rebuildMenu())
  }

  public rebuildMenu(): void {
    if (!this.tray) return

    const servers = this.config.getServers()
    const states = this.serverManager.getAllRuntimeStates()

    const serverItems: Electron.MenuItemConstructorOptions[] =
      servers.length === 0
        ? [{ label: 'No servers created yet', enabled: false }]
        : servers.map((srv) => {
            const st = states[srv.id]?.status || 'offline'
            const isOnline = st === 'online' || st === 'starting'
            return {
              label: `${isOnline ? '🟢' : '⚪'} ${srv.name} (${srv.software} ${srv.version})`,
              submenu: [
                {
                  label: isOnline ? 'Stop Server' : 'Start Server',
                  click: () => {
                    if (isOnline) {
                      this.serverManager.stopServer(srv.id).catch(() => {})
                    } else {
                      this.serverManager.startServer(srv.id).catch(() => {})
                    }
                  }
                },
                {
                  label: 'Restart Server',
                  enabled: isOnline,
                  click: () => {
                    this.serverManager.restartServer(srv.id).catch(() => {})
                  }
                }
              ]
            }
          })

    const menu = Menu.buildFromTemplate([
      {
        label: 'Open BlockHost Dashboard',
        click: () => {
          const win = this.getMainWindow()
          if (win) {
            win.show()
            win.focus()
          }
        }
      },
      { type: 'separator' },
      ...serverItems,
      { type: 'separator' },
      {
        label: 'Stop All Running Servers',
        click: () => {
          this.serverManager.stopAllServers().catch(() => {})
        }
      },
      {
        label: 'Quit BlockHost',
        click: () => {
          this.onQuitRequested()
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(menu)
  }
}
