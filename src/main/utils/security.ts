import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

/**
 * Ensures `childPath` resolves strictly inside `rootDir` to prevent path-traversal attacks.
 */
export function resolveSafePath(rootDir: string, relativeTarget: string): string {
  const normalizedRoot = path.resolve(rootDir)
  const cleaned = relativeTarget.replace(/^[/\\]+/, '')
  const resolved = path.resolve(normalizedRoot, cleaned)
  const rootWithSep = normalizedRoot.endsWith(path.sep) ? normalizedRoot : normalizedRoot + path.sep
  if (resolved !== normalizedRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Security violation: Path traversal blocked (${relativeTarget})`)
  }
  return resolved
}

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(`blockhost-pin-salt:${pin}`).digest('hex')
}

export function verifyPin(pin: string, expectedHash: string): boolean {
  if (!expectedHash) return true
  const candidate = hashPin(pin)
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(expectedHash, 'hex'))
}

export async function computeFileHash(filePath: string, algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha256'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm)
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export function getDirectorySize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0
  let total = 0
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name)
    try {
      if (entry.isDirectory()) {
        total += getDirectorySize(full)
      } else if (entry.isFile()) {
        total += fs.statSync(full).size
      }
    } catch {
      // ignore locked files
    }
  }
  return total
}

export function encryptSecret(plainText: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { safeStorage } = require('electron')
    if (safeStorage?.isEncryptionAvailable?.()) {
      return 'dpapi:' + safeStorage.encryptString(plainText).toString('base64')
    }
  } catch {
    // fallback below
  }
  const key = crypto.createHash('sha256').update('blockhost-local-vault-key').digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `aes:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export function decryptSecret(payload: string): string | null {
  try {
    if (payload.startsWith('dpapi:')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { safeStorage } = require('electron')
      if (safeStorage?.isEncryptionAvailable?.()) {
        return safeStorage.decryptString(Buffer.from(payload.slice(6), 'base64'))
      }
      return null
    }
    if (payload.startsWith('aes:')) {
      const [, ivHex, tagHex, encHex] = payload.split(':')
      const key = crypto.createHash('sha256').update('blockhost-local-vault-key').digest()
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
      const dec = Buffer.concat([
        decipher.update(Buffer.from(encHex, 'hex')),
        decipher.final()
      ])
      return dec.toString('utf-8')
    }
    return payload
  } catch {
    return null
  }
}

