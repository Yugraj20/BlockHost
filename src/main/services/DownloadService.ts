import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { EventEmitter } from 'events'
import { DownloadTask } from '../../shared/types'
import { computeFileHash } from '../utils/security'
import { logger } from '../utils/logger'

export class DownloadService extends EventEmitter {
  private tasks: Map<string, DownloadTask> = new Map()

  public getTasks(): DownloadTask[] {
    return Array.from(this.tasks.values()).reverse()
  }

  public async downloadFile(options: {
    title: string
    url: string
    destPath: string
    expectedSha1?: string
    expectedSha256?: string
  }): Promise<string> {
    if (!options.url.startsWith('https://') && !options.url.startsWith('http://127.0.0.1')) {
      throw new Error(`Security policy: Only HTTPS downloads are permitted (${options.url})`)
    }

    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const task: DownloadTask = {
      id,
      title: options.title,
      url: options.url,
      destPath: options.destPath,
      totalBytes: 0,
      downloadedBytes: 0,
      status: 'downloading',
      sha256: options.expectedSha256
    }

    this.tasks.set(id, task)
    this.emit('updated', this.getTasks())

    fs.mkdirSync(path.dirname(options.destPath), { recursive: true })

    try {
      await this.fetchStreamWithRedirects(options.url, options.destPath, (downloaded, total) => {
        task.downloadedBytes = downloaded
        task.totalBytes = total
        this.emit('updated', this.getTasks())
      })

      if (options.expectedSha1) {
        task.status = 'verifying'
        this.emit('updated', this.getTasks())
        const actual = await computeFileHash(options.destPath, 'sha1')
        if (actual.toLowerCase() !== options.expectedSha1.toLowerCase()) {
          fs.unlinkSync(options.destPath)
          throw new Error(`SHA-1 mismatch: expected ${options.expectedSha1}, got ${actual}`)
        }
      }

      if (options.expectedSha256) {
        task.status = 'verifying'
        this.emit('updated', this.getTasks())
        const actual = await computeFileHash(options.destPath, 'sha256')
        if (actual.toLowerCase() !== options.expectedSha256.toLowerCase()) {
          fs.unlinkSync(options.destPath)
          throw new Error(`SHA-256 mismatch: expected ${options.expectedSha256}, got ${actual}`)
        }
      }

      task.status = 'completed'
      this.emit('updated', this.getTasks())
      logger.info(`Download completed: ${options.title} -> ${options.destPath}`)
      return options.destPath
    } catch (err) {
      task.status = 'failed'
      task.error = (err as Error).message
      this.emit('updated', this.getTasks())
      logger.error(`Download failed: ${options.title}`, err)
      throw err
    }
  }

  private fetchStreamWithRedirects(
    url: string,
    destPath: string,
    onProgress: (downloaded: number, total: number) => void,
    redirectCount = 0
  ): Promise<void> {
    if (redirectCount > 8) {
      return Promise.reject(new Error('Too many redirects'))
    }

    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http
      const req = client.get(
        url,
        {
          headers: {
            'User-Agent': 'ChunkHarbor/0.2.2 (Windows; MinecraftServerManager)'
          }
        },
        (res) => {
          if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, url).toString()
            res.resume()
            this.fetchStreamWithRedirects(redirectUrl, destPath, onProgress, redirectCount + 1)
              .then(resolve)
              .catch(reject)
            return
          }

          if (res.statusCode !== 200) {
            res.resume()
            reject(new Error(`HTTP ${res.statusCode} when downloading ${url}`))
            return
          }

          const total = parseInt(res.headers['content-length'] || '0', 10)
          let downloaded = 0
          let lastEmit = 0

          const fileStream = fs.createWriteStream(destPath)
          res.on('data', (chunk: Buffer) => {
            downloaded += chunk.length
            const now = Date.now()
            if (now - lastEmit > 120 || downloaded === total) {
              lastEmit = now
              onProgress(downloaded, total)
            }
          })

          res.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close()
            onProgress(downloaded, total || downloaded)
            resolve()
          })

          fileStream.on('error', (err) => {
            fs.unlink(destPath, () => {})
            reject(err)
          })
        }
      )

      req.on('error', reject)
    })
  }
}
