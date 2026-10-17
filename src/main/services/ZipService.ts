import fs from 'fs'
import path from 'path'
import yauzl from 'yauzl'
import archiver from 'archiver'
import { resolveSafePath } from '../utils/security'

export class ZipService {
  /**
   * Extract a ZIP archive safely into targetDir, preventing Zip-Slip path traversal.
   */
  public static async extractZip(zipPath: string, targetDir: string): Promise<void> {
    fs.mkdirSync(targetDir, { recursive: true })
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err || new Error('Unable to open zip'))

        zipfile.readEntry()
        zipfile.on('entry', (entry) => {
          let destPath: string
          try {
            destPath = resolveSafePath(targetDir, entry.fileName)
          } catch (secErr) {
            zipfile.close()
            return reject(secErr)
          }

          if (/\/$/.test(entry.fileName)) {
            fs.mkdirSync(destPath, { recursive: true })
            zipfile.readEntry()
          } else {
            fs.mkdirSync(path.dirname(destPath), { recursive: true })
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                zipfile.close()
                return reject(streamErr || new Error('Failed to open zip entry stream'))
              }
              const writeStream = fs.createWriteStream(destPath)
              readStream.on('error', (rErr) => {
                writeStream.destroy()
                zipfile.close()
                reject(rErr)
              })
              writeStream.on('error', (wErr) => {
                zipfile.close()
                reject(wErr)
              })
              writeStream.on('close', () => zipfile.readEntry())
              readStream.pipe(writeStream)
            })
          }
        })

        zipfile.on('end', () => resolve())
        zipfile.on('error', reject)
      })
    })
  }

  /**
   * Create a ZIP archive from sourceDir (or a subset of folders).
   */
  public static async createZip(
    sourceDir: string,
    outputZipPath: string,
    subPaths?: string[]
  ): Promise<number> {
    fs.mkdirSync(path.dirname(outputZipPath), { recursive: true })
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputZipPath)
      const archive = archiver('zip', { zlib: { level: 6 } })

      output.on('close', () => resolve(archive.pointer()))
      archive.on('error', reject)
      archive.pipe(output)

      if (subPaths && subPaths.length > 0) {
        for (const sub of subPaths) {
          const full = resolveSafePath(sourceDir, sub)
          if (fs.existsSync(full)) {
            const stat = fs.statSync(full)
            if (stat.isDirectory()) {
              archive.directory(full, sub)
            } else {
              archive.file(full, { name: sub })
            }
          }
        }
      } else {
        archive.directory(sourceDir, false)
      }

      archive.finalize()
    })
  }
}
