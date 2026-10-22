import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import { resolveSafePath, hashPin, verifyPin, encryptSecret, decryptSecret } from '../src/main/utils/security'
import { JavaManager } from '../src/main/services/JavaManager'
import { ZipService } from '../src/main/services/ZipService'
import { PLAYIT_API_BASE } from '../src/shared/constants'
import { SERVER_PRESETS } from '../src/renderer/src/pages/CreateServerPage'
import {
  PlayitProtoCodec,
  MessageCodec,
  ControlFeedId,
  ControlResponseId,
  ControlRequestId,
  PLAYIT_AGENT_VERSION,
  UDP_CHANNEL_ESTABLISH_ID
} from '../src/main/services/playit/PlayitProtoCodec'

describe('ChunkHarbor Core & Live Integration Suite', () => {
  it('blocks path traversal outside server root directory', () => {
    const root = path.join(os.tmpdir(), 'ChunkHarbor', 'servers', 'test')
    const valid = resolveSafePath(root, 'logs/latest.log')
    expect(valid).toContain('latest.log')

    expect(() => resolveSafePath(root, '../../Windows/System32/cmd.exe')).toThrow(
      /Security violation/
    )
  })

  it('hashes and verifies PIN codes and encrypts/decrypts secrets', () => {
    const hash = hashPin('4829')
    expect(verifyPin('4829', hash)).toBe(true)
    expect(verifyPin('0000', hash)).toBe(false)

    const enc = encryptSecret('playit-secret-token-hex')
    expect(decryptSecret(enc)).toBe('playit-secret-token-hex')
  })

  it('maps Minecraft versions to required Java major versions accurately', () => {
    expect(JavaManager.getRequiredJavaVersion('1.12.2')).toBe(8)
    expect(JavaManager.getRequiredJavaVersion('1.16.5')).toBe(8)
    expect(JavaManager.getRequiredJavaVersion('1.18.2')).toBe(17)
    expect(JavaManager.getRequiredJavaVersion('1.20.4')).toBe(17)
    expect(JavaManager.getRequiredJavaVersion('1.20.5')).toBe(21)
    expect(JavaManager.getRequiredJavaVersion('1.21.4')).toBe(21)
    expect(JavaManager.getRequiredJavaVersion('26.1')).toBe(25)
    expect(JavaManager.getRequiredJavaVersion('26.3')).toBe(25)
  })

  it('matches official upstream playit-agent binary encoding test vectors', () => {
    // Official test vector from packages/agent_proto/src/control_messages.rs line 1209:
    // ControlRpcMessage { request_id: 1, content: ControlRequest::_PingV1(PingV1 { now: 0, current_ping: None }) }
    const pingV1 = PlayitProtoCodec.encodePingV1Rpc(1n, { now: 0n, currentPing: null })
    expect(pingV1.toString('hex')).toBe('000000000000000100000001000000000000000000')

    // SocketAddr encoding from control_messages.rs line 1175 & 1203:
    const addr4 = MessageCodec.writeSocketAddr({ ip: '127.0.0.1', port: 4123, family: 4 })
    expect(addr4.toString('hex')).toBe('047f000001101b')
    const addr6 = MessageCodec.writeSocketAddr({ ip: '::88', port: 4123, family: 6 })
    expect(addr6.toString('hex')).toBe('0600000000000000000000000000000088101b')

    // PingV2 RPC encoding
    const pingV2 = PlayitProtoCodec.encodePingRpc(1n, {
      now: 1729000000000n,
      currentPing: 24,
      sessionId: { sessionId: 10n, accountId: 20n, agentId: 30n }
    })
    expect(pingV2.readBigUInt64BE(0)).toBe(1n)
    expect(pingV2.readUInt32BE(8)).toBe(ControlRequestId.PingV2)
    expect(pingV2.readBigUInt64BE(12)).toBe(1729000000000n)
  })

  it('decodes ControlFeed::Response(Pong) and ControlFeed::NewClient accurately', () => {
    const header = Buffer.alloc(4 + 8 + 4 + 8 + 8 + 8 + 4)
    header.writeUInt32BE(ControlFeedId.Response, 0)
    header.writeBigUInt64BE(1n, 4)
    header.writeUInt32BE(ControlResponseId.Pong, 12)
    header.writeBigUInt64BE(1000n, 16)
    header.writeBigUInt64BE(1025n, 24)
    header.writeBigUInt64BE(77n, 32)
    header.writeUInt32BE(3, 40)
    const clientAddr = MessageCodec.writeSocketAddr({ ip: '203.0.113.5', port: 54321, family: 4 })
    const tunnelAddr = MessageCodec.writeSocketAddr({ ip: '198.51.100.9', port: 5525, family: 4 })
    const optNone = Buffer.from([0])

    const pongFeedPacket = Buffer.concat([header, clientAddr, tunnelAddr, optNone])
    const decoded = PlayitProtoCodec.decodeControlFeed(pongFeedPacket)
    expect(decoded.type).toBe('Response')
    if (decoded.type === 'Response') {
      expect(decoded.requestId).toBe(1n)
      expect(decoded.response.type).toBe('Pong')
      if (decoded.response.type === 'Pong') {
        expect(decoded.response.data.clientAddr.ip).toBe('203.0.113.5')
        expect(decoded.response.data.tunnelAddr.port).toBe(5525)
        expect(decoded.response.data.sessionExpireAt).toBeNull()
      }
    }
  })

  it('encodes and decodes UdpFlow footers and UDP_CHANNEL_ESTABLISH_ID', () => {
    const payload = Buffer.from('hello-bedrock-packet', 'utf-8')
    const framed = PlayitProtoCodec.appendUdpFlowFooter(payload, {
      family: 4,
      src: { ip: '98.123.12.1', port: 4111, family: 4 },
      dst: { ip: '55.32.65.11', port: 9912, family: 4 },
      extension: { tunnelId: 123456n, portOffset: 2 }
    })

    const parsed = PlayitProtoCodec.parseUdpFlowFromTail(framed)
    expect(parsed.type).toBe('flow')
    if (parsed.type === 'flow') {
      expect(parsed.payload.toString('utf-8')).toBe('hello-bedrock-packet')
      expect(parsed.flow.src.ip).toBe('98.123.12.1')
      expect(parsed.flow.dst.port).toBe(9912)
      expect(parsed.flow.extension?.tunnelId).toBe(123456n)
      expect(parsed.flow.extension?.portOffset).toBe(2)
    }

    const establishPkt = Buffer.alloc(16)
    establishPkt.writeBigUInt64BE(UDP_CHANNEL_ESTABLISH_ID, 8)
    expect(PlayitProtoCodec.parseUdpFlowFromTail(establishPkt).type).toBe('establish')
  })

  it('compresses and extracts ZIP archives with ZipSlip protection', async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'chunkharbor-zip-'))
    const srcDir = path.join(tmpBase, 'src')
    const outDir = path.join(tmpBase, 'out')
    const zipFile = path.join(tmpBase, 'backup.zip')

    fs.mkdirSync(srcDir, { recursive: true })
    fs.writeFileSync(path.join(srcDir, 'server.properties'), 'server-port=25565\n')

    await ZipService.createZip(srcDir, zipFile)
    expect(fs.existsSync(zipFile)).toBe(true)

    await ZipService.extractZip(zipFile, outDir)
    expect(fs.readFileSync(path.join(outDir, 'server.properties'), 'utf-8')).toContain('25565')

    fs.rmSync(tmpBase, { recursive: true, force: true })
  })

  it('registers a real claim code against https://api.playit.gg/claim/setup', async () => {
    const claimCode = crypto.randomBytes(5).toString('hex')
    const res = await fetch(`${PLAYIT_API_BASE}/claim/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': `playit-agent/${PLAYIT_AGENT_VERSION.version_major}.${PLAYIT_AGENT_VERSION.version_minor}.${PLAYIT_AGENT_VERSION.version_patch}`
      },
      body: JSON.stringify({
        code: claimCode,
        agent_type: 'self-managed',
        version: `chunkharbor ${PLAYIT_AGENT_VERSION.version_major}.${PLAYIT_AGENT_VERSION.version_minor}.${PLAYIT_AGENT_VERSION.version_patch}`
      })
    })
    expect(res.ok).toBe(true)
    const json = (await res.json()) as { status: string; data: string }
    expect(json.status).toBe('success')
    expect(json.data).toBe('WaitingForUserVisit')
  })

  it('fetches live PaperMC versions and build download URLs from Fill v3 API', async () => {
    const res = await fetch('https://fill.papermc.io/v3/projects/paper', {
      headers: { 'User-Agent': 'ChunkHarbor/0.2.2' }
    })
    expect(res.ok).toBe(true)
    const data = (await res.json()) as { versions: Record<string, string[]> }
    const versions = Object.values(data.versions || {}).flat()
    expect(versions.length).toBeGreaterThan(10)
    expect(versions).toContain('1.21.4')

    const buildsRes = await fetch('https://fill.papermc.io/v3/projects/paper/versions/1.21.4/builds', {
      headers: { 'User-Agent': 'ChunkHarbor/0.2.2' }
    })
    expect(buildsRes.ok).toBe(true)
    const builds = (await buildsRes.json()) as Array<{
      id: number
      downloads: { 'server:default'?: { url: string; checksums?: { sha256?: string } } }
    }>
    expect(builds[0]?.downloads?.['server:default']?.url).toContain('fill-data.papermc.io')
  })

  it('correctly matches player join, leave, and UUID regexes including GeyserMC/Floodgate Bedrock names', () => {
    const uuidRegex = /(?:UUID of player|User)\s+([A-Za-z0-9_.*-]{1,20})\s+(?:\([^)]*\)\s+)?(?:is|has UUID)\s+([0-9a-fA-F-]{32,36})/
    const joinRegex = /(?:\[Server thread\/INFO\]|\[Server-Worker-[^\]]+\]|\]):\s+([A-Za-z0-9_.*-]{1,20})\s+(?:joined the game|logged in)/
    const leaveRegex = /(?:\[Server thread\/INFO\]|\[Server-Worker-[^\]]+\]|\]):\s+([A-Za-z0-9_.*-]{1,20})\s+(?:left the game|lost connection)/

    // Standard Java Player
    const javaJoin = '[19:12:00] [Server thread/INFO]: Alex joined the game'
    expect(javaJoin.match(joinRegex)?.[1]).toBe('Alex')

    // Bedrock / GeyserMC Player with dot prefix
    const bedrockJoin = '[19:12:05] [Server thread/INFO]: .Steve_Xbox joined the game'
    expect(bedrockJoin.match(joinRegex)?.[1]).toBe('.Steve_Xbox')

    // Floodgate Player with star prefix
    const floodgateLeave = '[19:14:10] [Server thread/INFO]: *Alex123 left the game'
    expect(floodgateLeave.match(leaveRegex)?.[1]).toBe('*Alex123')

    // UUID log matching
    const uuidLine = '[19:12:05] [Server thread/INFO]: UUID of player .Steve_Xbox is 00000000-0000-0000-0009-01f28b7e2831'
    const uuidMatched = uuidLine.match(uuidRegex)
    expect(uuidMatched?.[1]).toBe('.Steve_Xbox')
    expect(uuidMatched?.[2]).toBe('00000000-0000-0000-0009-01f28b7e2831')
  })

  it('validates server creation presets & templates configurations', () => {
    expect(SERVER_PRESETS.length).toBeGreaterThanOrEqual(4)
    for (const preset of SERVER_PRESETS) {
      expect(preset.id).toBeTruthy()
      expect(preset.name).toBeTruthy()
      expect(preset.software).toMatch(/paper|vanilla|purpur|fabric|forge|neoforge|quilt/)
      expect(preset.ramMb).toBeGreaterThanOrEqual(1024)
      expect(['survival', 'creative', 'adventure', 'spectator']).toContain(preset.gamemode)
      expect(['peaceful', 'easy', 'normal', 'hard']).toContain(preset.difficulty)
      expect(preset.maxPlayers).toBeGreaterThan(0)
      expect(preset.motd).toBeTruthy()
    }
  })
})
