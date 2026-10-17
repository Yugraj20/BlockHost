import { Notification } from 'electron'
import { EventEmitter } from 'events'
import { ConfigService } from './ConfigService'
import { NotificationItem } from '../../shared/types'

export class NotificationService extends EventEmitter {
  constructor(private config: ConfigService) {
    super()
  }

  public notify(options: {
    title: string
    body: string
    level: 'info' | 'success' | 'warning' | 'error'
    category?: 'crash' | 'backup' | 'player_join' | 'general'
  }): NotificationItem | null {
    const settings = this.config.getSettings()
    if (!settings.notificationsEnabled) return null

    if (options.category === 'crash' && !settings.notifyOnCrash) return null
    if (options.category === 'backup' && !settings.notifyOnBackup) return null
    if (options.category === 'player_join' && !settings.notifyOnPlayerJoin) return null

    const item = this.config.addNotification({
      title: options.title,
      body: options.body,
      level: options.level
    })

    this.emit('updated', this.config.getNotifications())

    if (settings.desktopToastsEnabled && Notification.isSupported()) {
      try {
        const toast = new Notification({
          title: options.title,
          body: options.body
        })
        toast.show()
      } catch {
        // Ignore toast errors in headless environments
      }
    }

    return item
  }
}
