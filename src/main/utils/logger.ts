import log from 'electron-log'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

const logsDir = path.join(app?.getPath ? app.getPath('userData') : path.resolve('.'), 'logs')
fs.mkdirSync(logsDir, { recursive: true })

log.transports.file.resolvePathFn = () => path.join(logsDir, 'blockhost.log')
log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB rotation
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

export const logger = log

export function getAppLogTail(maxLines = 300): string[] {
  try {
    const logFile = path.join(logsDir, 'blockhost.log')
    if (!fs.existsSync(logFile)) return ['[BlockHost] Log file initialized.']
    const content = fs.readFileSync(logFile, 'utf-8')
    const lines = content.split(/\r?\n/).filter(Boolean)
    return lines.slice(-maxLines)
  } catch (err) {
    return [`Failed to read application log: ${(err as Error).message}`]
  }
}
