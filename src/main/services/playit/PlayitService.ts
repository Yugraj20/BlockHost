import dgram from 'dgram'
import net from 'net'
import crypto from 'crypto'
import { EventEmitter } from 'events'
import { shell } from 'electron'
import { PLAYIT_API_BASE } from '../../../shared/constants'
import { PlayitState, PlayitTunnel } from '../../../shared/types'
import { ConfigService } from '../ConfigService'
import { decryptSecret, encryptSecret } from '../../utils/security'
import { logger } from '../../utils/logger'
import {
  AgentSessionId,
  MessageCodec,
  NewClientEvent,
  PLAYIT_AGENT_VERSION,
  PLAYIT_PROTO_VERSION,
  PlayitProtoCodec,
  PongResponse,
  SocketAddress,
  UdpChannelDetailsResponse,
  UdpFlow
} from './PlayitProtoCodec'

interface ApiResult<S, F = unknown> {
  status: 'success' | 'fail' | 'error'
  data: S & F & { type?: string; message?: unknown }
}

interface AgentTunnelAttr {
  name: string
  value: string
}

interface AgentTunnelV1 {
  id: string
  internal_id: number
  name: string
  display_address: string
  port_type: 'tcp' | 'udp' | 'both'
  port_count: number
  tunnel_type: string | null
  tunnel_type_display: string
  agent_config: { fields: AgentTunnelAttr[] }
  disabled_reason: string | null
}

interface AgentPendingTunnelV1 {
  id: string
  name: string
  tunnel_type: string | null
  tunnel_type_display: string
  port_type: 'tcp' | 'udp' | 'both'
  port_count: number
  status_msg: string
}

interface AgentRunDataV1 {
  agent_id: string
  tunnels: AgentTunnelV1[]
  pending: AgentPendingTunnelV1[]
  notices: Array<{ priority: string; message: string; resolve_link?: string | null }>
  permissions: {
    is_self_managed: boolean
    has_premium: boolean
    account_status: string
  }
}

interface AgentRoutingResponse {
  agent_id: string
  targets4: string[]
  targets6: string[]
  disable_ip6: boolean
}

interface SignedAgentKeyResponse {
  key: string
}

interface VirtualUdpClient {
  socket: dgram.Socket
  flow: UdpFlow
  targetIp: string
  targetPort: number
  lastActiveMs: number
}

/**
 * Built-in TypeScript port of playit-cloud/playit-agent (v1.0.12, proto v2).
 * Runs 100% inside the Electron main process using native Node dgram/net/fetch.
 * Does NOT spawn any external playit.exe process.
 */
export class PlayitService extends EventEmitter {
  private config: ConfigService
  private secretKey?: string
  private controlSocket: dgram.Socket | null = null
  private udpChannelSocket: dgram.Socket | null = null

  private claimPollTimer: NodeJS.Timeout | null = null
  private controlLoopTimer: NodeJS.Timeout | null = null
  private rundataTimer: NodeJS.Timeout | null = null
  private udpEstablishTimer: NodeJS.Timeout | null = null

  private activeTcpSockets: Set<net.Socket> = new Set()
  private virtualUdpClients: Map<string, VirtualUdpClient> = new Map()

  private nextRequestId = 2n
  private controlAddr: SocketAddress | null = null
  private lastPong: PongResponse | null = null
  private lastPongRxMs = 0
  private sessionId: AgentSessionId | null = null
  private sessionExpiresAt = 0n
  private lastKeepAliveSentMs = 0
  private lastRegisterSentMs = 0
  private currentLatencyMs = 0

  private udpChannelDetails: UdpChannelDetailsResponse | null = null
  private udpEstablishRxEpochMs = 0
  private lastUdpAuthSentMs = 0

  private state: PlayitState = {
    linked: false,
    controlChannelStatus: 'disconnected',
    protocolVersion: `playit-agent/${PLAYIT_AGENT_VERSION.version_major}.${PLAYIT_AGENT_VERSION.version_minor}.${PLAYIT_AGENT_VERSION.version_patch} (proto v${PLAYIT_PROTO_VERSION})`,
    tunnels: []
  }

  constructor(config: ConfigService) {
    super()
    this.config = config
  }

  public getState(): PlayitState {
    return {
      ...this.state,
      tunnels: this.state.tunnels.map((t) => ({ ...t }))
    }
  }

  private emitUpdated(): void {
    this.emit('updated', this.getState())
  }

  public restoreSession(): void {
    const saved = this.config.getPlayitSecret()
    if (saved.encrypted) {
      const decrypted = decryptSecret(saved.encrypted)
      if (decrypted && !decrypted.startsWith('dpapi:') && !decrypted.startsWith('aes:')) {
        this.secretKey = decrypted
        this.state.linked = true
        this.state.agentId = saved.agentId
        this.startAgent().catch((err) => {
          logger.warn(`[PlayitService] Auto-connect on startup failed: ${(err as Error).message}`)
        })
      } else if (!decrypted) {
        logger.debug('[PlayitService] Stored secret key could not be decrypted yet or is invalid')
      }
    }
  }

  /**
   * Perform an authenticated or unauthenticated POST call to `https://api.playit.gg`.
   * Matches `packages/api_client/src/http_client.rs` (`Authorization: Agent-Key <secret>`).
   */
  private async callPlayitApi<Res>(
    path: string,
    body: Record<string, unknown>,
    secretOverride?: string
  ): Promise<Res> {
    const secret = (secretOverride !== undefined ? secretOverride : this.secretKey)?.trim()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': `playit-agent/${PLAYIT_AGENT_VERSION.version_major}.${PLAYIT_AGENT_VERSION.version_minor}.${PLAYIT_AGENT_VERSION.version_patch}`
    }
    if (secret) {
      headers['Authorization'] = `Agent-Key ${secret}`
    }

    const res = await fetch(`${PLAYIT_API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    })

    const text = await res.text()
    let parsed: ApiResult<Res>
    try {
      parsed = JSON.parse(text) as ApiResult<Res>
    } catch {
      throw new Error(`HTTP ${res.status} from ${path}: ${text.slice(0, 200)}`)
    }

    if (parsed.status === 'success') {
      return parsed.data
    }
    if ((parsed as any)?.data?.message === 'InvalidAgentKey') {
      logger.warn(`[PlayitService] Playit API rejected agent key on ${path}, clearing invalid key`)
      this.unlinkAccount()
      this.state.lastError =
        'Your playit.gg Agent Secret Key was invalid or expired. Please click Link Account Now to connect.'
      this.emitUpdated()
      throw new Error('Playit Agent Key is invalid or expired. Please link your account again.')
    }
    if (parsed.status === 'fail') {
      throw new Error(`Playit API fail (${path}): ${JSON.stringify(parsed.data)}`)
    }
    throw new Error(`Playit API error (${path}): ${JSON.stringify(parsed.data)}`)
  }

  /**
   * Step 1: Begin interactive claim flow via `/claim/setup` + `/claim/exchange`.
   * Never fabricates a fake secret key — waits for the user to approve the claim URL on playit.gg.
   */
  public async startClaimFlow(openBrowser = true): Promise<PlayitState> {
    const claimCode = crypto.randomBytes(5).toString('hex')
    const claimUrl = `https://playit.gg/claim/${claimCode}`

    this.state.claimCode = claimCode
    this.state.claimUrl = claimUrl
    this.state.controlChannelStatus = 'claiming'
    this.state.lastError = undefined
    this.emitUpdated()

    if (openBrowser) {
      try {
        await shell.openExternal(claimUrl)
      } catch {
        // ignore in headless test mode
      }
    }

    this.pollClaimExchange(claimCode)
    return this.getState()
  }

  private pollClaimExchange(claimCode: string): void {
    if (this.claimPollTimer) clearInterval(this.claimPollTimer)

    let setupAccepted = false
    let attempts = 0

    this.claimPollTimer = setInterval(async () => {
      attempts++
      if (attempts > 120) {
        if (this.claimPollTimer) clearInterval(this.claimPollTimer)
        this.claimPollTimer = null
        if (!this.state.linked) {
          this.state.controlChannelStatus = 'error'
          this.state.lastError =
            'Claim code expired before confirmation on playit.gg. Click Generate Claim Link to try again.'
          this.emitUpdated()
        }
        return
      }

      try {
        if (!setupAccepted) {
          const setupState = await this.callPlayitApi<string>(
            '/claim/setup',
            {
              code: claimCode,
              agent_type: 'self-managed',
              version: `chunkharbor ${PLAYIT_AGENT_VERSION.version_major}.${PLAYIT_AGENT_VERSION.version_minor}.${PLAYIT_AGENT_VERSION.version_patch}`
            },
            ''
          )
          logger.info(`[PlayitService] /claim/setup state for ${claimCode}: ${setupState}`)
          if (setupState === 'UserRejected') {
            if (this.claimPollTimer) clearInterval(this.claimPollTimer)
            this.claimPollTimer = null
            this.state.controlChannelStatus = 'error'
            this.state.lastError = 'Claim request was rejected on playit.gg.'
            this.emitUpdated()
            return
          }
          if (setupState === 'UserAccepted') {
            setupAccepted = true
          }
        }

        if (setupAccepted) {
          const exchanged = await this.callPlayitApi<{ secret_key: string }>(
            '/claim/exchange',
            { code: claimCode },
            ''
          )
          if (exchanged?.secret_key) {
            if (this.claimPollTimer) clearInterval(this.claimPollTimer)
            this.claimPollTimer = null
            await this.linkWithSecretKey(exchanged.secret_key)
          }
        }
      } catch (err) {
        logger.debug(`[PlayitService] Claim poll waiting for user confirmation: ${String(err)}`)
      }
    }, 2500)
  }

  /**
   * Step 2: Link with an explicit playit.gg Agent Secret Key (or key exchanged from claim flow).
   * Validates the key against `POST /v1/agents/rundata` before persisting.
   */
  public async linkWithSecretKey(providedSecretKey?: string): Promise<PlayitState> {
    const clean = providedSecretKey?.trim()
    if (!clean) {
      if (this.state.claimCode) {
        this.state.lastError = `Waiting for confirmation on ${this.state.claimUrl} — approve the agent in your browser, or paste your Agent Secret Key below.`
        this.emitUpdated()
        return this.getState()
      }
      this.state.controlChannelStatus = 'error'
      this.state.lastError =
        'Please paste a valid playit.gg Agent Secret Key or click "Generate Claim Link" and approve it in your browser.'
      this.emitUpdated()
      return this.getState()
    }

    this.state.controlChannelStatus = 'reconnecting'
    this.state.lastError = undefined
    this.emitUpdated()

    try {
      const runData = await this.callPlayitApi<AgentRunDataV1>('/v1/agents/rundata', {}, clean)
      this.secretKey = clean
      this.state.linked = true
      this.state.agentId = runData.agent_id
      this.state.claimCode = undefined
      this.state.claimUrl = undefined
      this.config.setPlayitSecret(encryptSecret(clean), runData.agent_id)

      this.syncTunnelsFromRunData(runData)
      await this.startAgent()

      this.config.addActivity({
        type: 'tunnel',
        title: 'playit.gg Agent Linked',
        subtitle: `In-process agent ${runData.agent_id} authenticated with playit.gg`
      })
      return this.getState()
    } catch (err) {
      this.state.controlChannelStatus = 'error'
      this.state.lastError = `Failed to verify playit.gg Secret Key: ${(err as Error).message}`
      this.emitUpdated()
      return this.getState()
    }
  }

  public unlinkAccount(): PlayitState {
    if (this.claimPollTimer) {
      clearInterval(this.claimPollTimer)
      this.claimPollTimer = null
    }
    this.stopSocketsAndTimers()
    this.secretKey = undefined
    this.config.setPlayitSecret(undefined, undefined)
    for (const srv of this.config.getServers()) {
      if (srv.playitTunnelId || srv.playitPublicAddress) {
        srv.playitTunnelId = undefined
        srv.playitPublicAddress = undefined
        this.config.upsertServer(srv)
      }
    }
    this.state = {
      linked: false,
      controlChannelStatus: 'disconnected',
      protocolVersion: `playit-agent/${PLAYIT_AGENT_VERSION.version_major}.${PLAYIT_AGENT_VERSION.version_minor}.${PLAYIT_AGENT_VERSION.version_patch} (proto v${PLAYIT_PROTO_VERSION})`,
      tunnels: []
    }
    this.emitUpdated()
    return this.getState()
  }

  /**
   * Synchronize tunnels from `/v1/agents/rundata` (`OriginResource::from_agent_tunnel`).
   */
  private syncTunnelsFromRunData(runData: AgentRunDataV1): void {
    this.state.agentId = runData.agent_id
    const servers = this.config.getServers()

    const remoteTunnels: PlayitTunnel[] = runData.tunnels.map((t) => {
      const localIpField =
        t.agent_config.fields.find((f) => f.name === 'local_ip')?.value?.trim() || '127.0.0.1'
      const localPortStr = t.agent_config.fields.find((f) => f.name === 'local_port')?.value?.trim()
      let localPort = localPortStr ? parseInt(localPortStr, 10) : NaN
      if (Number.isNaN(localPort)) {
        const displayPort = t.display_address.split(':').pop()
        localPort = displayPort ? parseInt(displayPort, 10) || 25565 : 25565
      }

      const matchingSrv = servers.find((s) => s.port === localPort)
      const existing = this.state.tunnels.find((ex) => ex.id === t.id)
      const publicPort = parseInt(t.display_address.split(':').pop() || '0', 10) || localPort

      const tunnel: PlayitTunnel = {
        id: t.id,
        internalId: t.internal_id,
        serverId: matchingSrv?.id || '',
        name: t.name || matchingSrv?.name || t.tunnel_type_display || 'Playit Tunnel',
        proto: t.port_type,
        localIp: localIpField,
        localPort,
        publicAddress: t.display_address,
        publicPort,
        status: t.disabled_reason
          ? 'paused'
          : this.state.controlChannelStatus === 'connected'
            ? 'active'
            : 'connecting',
        activeConnections: existing?.activeConnections ?? 0,
        bytesIn: existing?.bytesIn ?? 0,
        bytesOut: existing?.bytesOut ?? 0,
        latencyMs: this.currentLatencyMs
      }

      if (matchingSrv && t.display_address && matchingSrv.playitPublicAddress !== t.display_address) {
        matchingSrv.playitTunnelId = t.id
        matchingSrv.playitPublicAddress = t.display_address
        this.config.upsertServer(matchingSrv)
      }

      return tunnel
    })

    for (const p of runData.pending) {
      if (!remoteTunnels.some((r) => r.id === p.id)) {
        remoteTunnels.push({
          id: p.id,
          serverId: '',
          name: p.name || p.tunnel_type_display || 'Pending Tunnel',
          proto: p.port_type,
          localIp: '127.0.0.1',
          localPort: servers[0]?.port || 25565,
          publicAddress: `Pending (${p.status_msg})`,
          publicPort: 0,
          status: 'connecting',
          activeConnections: 0,
          bytesIn: 0,
          bytesOut: 0,
          latencyMs: this.currentLatencyMs
        })
      }
    }

    this.state.tunnels = remoteTunnels
    if (this.state.linked && remoteTunnels.length > 0 && this.state.lastError) {
      this.state.lastError = undefined
    }
    this.emitUpdated()
  }

  /**
   * Start the in-process playit.gg control & data plane agent (`MaintainedControl` + `UdpChannel` + `TcpClients`).
   */
  public async startAgent(): Promise<PlayitState> {
    if (!this.secretKey) {
      this.state.controlChannelStatus = 'disconnected'
      this.emitUpdated()
      return this.getState()
    }

    this.stopSocketsAndTimers()
    this.state.controlChannelStatus = 'reconnecting'
    this.state.lastError = undefined
    this.emitUpdated()

    try {
      // 1. Fetch agent rundata & sync configured tunnels
      const runData = await this.callPlayitApi<AgentRunDataV1>('/v1/agents/rundata', {})
      this.syncTunnelsFromRunData(runData)

      // 2. Discover control UDP addresses via POST /agents/routing/get
      const routing = await this.callPlayitApi<AgentRoutingResponse>('/agents/routing/get', {
        agent_id: null
      })

      const candidateTargets: SocketAddress[] = []
      for (const ip4 of routing.targets4 || []) {
        candidateTargets.push({ ip: ip4, port: 5525, family: 4 })
      }
      if (candidateTargets.length === 0) {
        throw new Error('Playit routing returned no IPv4 control servers')
      }

      this.controlAddr = candidateTargets[0]
      this.state.controlServerAddress = `${this.controlAddr.ip}:${this.controlAddr.port}`

      // 3. Open UDP control socket and UDP data channel socket
      this.controlSocket = dgram.createSocket('udp4')
      this.controlSocket.on('message', (msg, rinfo) => this.handleControlDatagram(msg, rinfo))
      this.controlSocket.on('error', (err) => {
        logger.warn(`[PlayitService] Control UDP socket error: ${err.message}`)
      })

      this.udpChannelSocket = dgram.createSocket('udp4')
      this.udpChannelSocket.on('message', (msg, rinfo) => this.handleUdpChannelDatagram(msg, rinfo))
      this.udpChannelSocket.on('error', (err) => {
        logger.warn(`[PlayitService] Data UDP channel error: ${err.message}`)
      })

      // 4. Send initial PingV2 to establish control channel and trigger Pong -> /proto/register -> AgentRegistered
      this.lastPongRxMs = Date.now()
      this.sendControlPing(1n)

      // 5. Start control maintenance loop (every 2.5s)
      this.controlLoopTimer = setInterval(() => {
        this.maintainControlLoop().catch((err) => {
          logger.debug(`[PlayitService] maintainControlLoop error: ${String(err)}`)
        })
      }, 2500)

      // 6. Start rundata refresh loop (every 5s)
      this.rundataTimer = setInterval(async () => {
        try {
          const data = await this.callPlayitApi<AgentRunDataV1>('/v1/agents/rundata', {})
          this.syncTunnelsFromRunData(data)
        } catch (err) {
          logger.debug(`[PlayitService] rundata refresh error: ${String(err)}`)
        }
      }, 5000)

      // 7. Start UDP channel establish heartbeat loop (every 3s)
      this.udpEstablishTimer = setInterval(() => {
        this.maintainUdpChannel()
      }, 3000)

      return this.getState()
    } catch (err) {
      this.state.controlChannelStatus = 'error'
      this.state.lastError = (err as Error).message
      this.emitUpdated()
      return this.getState()
    }
  }

  private nextReqId(): bigint {
    const id = this.nextRequestId
    this.nextRequestId += 1n
    return id
  }

  private sendControlPing(reqId = this.nextReqId()): void {
    if (!this.controlSocket || !this.controlAddr) return
    const now = BigInt(Date.now())
    const packet = PlayitProtoCodec.encodePingRpc(reqId, {
      now,
      currentPing: this.currentLatencyMs > 0 ? this.currentLatencyMs : null,
      sessionId: this.sessionId
    })
    try {
      this.controlSocket.send(packet, this.controlAddr.port, this.controlAddr.ip)
    } catch {
      // ignore transient socket error
    }
  }

  private async maintainControlLoop(): Promise<void> {
    if (!this.controlSocket || !this.controlAddr) return
    const now = Date.now()

    if (this.lastPongRxMs > 0 && now - this.lastPongRxMs > 20_000) {
      logger.warn('[PlayitService] Control channel Pong timeout (>20s) — re-establishing routing & control socket')
      this.lastPongRxMs = now
      await this.startAgent()
      return
    }

    this.sendControlPing()

    if (this.sessionId) {
      const remainingMs = Number(this.sessionExpiresAt) - now
      if (remainingMs < 30_000 && now - this.lastKeepAliveSentMs > 5_000) {
        this.lastKeepAliveSentMs = now
        const pkt = PlayitProtoCodec.encodeAgentKeepAliveRpc(this.nextReqId(), this.sessionId)
        this.controlSocket.send(pkt, this.controlAddr.port, this.controlAddr.ip)
      }
      if (remainingMs <= 0 && this.lastPong && now - this.lastRegisterSentMs > 5_000) {
        await this.authenticateAndSendRegister(this.lastPong)
      }

      const hasUdpTunnel = this.state.tunnels.some(
        (t) => t.proto === 'udp' || t.proto === 'both'
      )
      const udpEstablishedRecently =
        this.udpEstablishRxEpochMs > 0 && now - this.udpEstablishRxEpochMs < 15_000
      if (hasUdpTunnel && !udpEstablishedRecently && now - this.lastUdpAuthSentMs > 5_000) {
        this.lastUdpAuthSentMs = now
        const pkt = PlayitProtoCodec.encodeSetupUdpChannelRpc(this.nextReqId(), this.sessionId)
        this.controlSocket.send(pkt, this.controlAddr.port, this.controlAddr.ip)
      }
    } else if (this.lastPong && now - this.lastRegisterSentMs > 5_000) {
      await this.authenticateAndSendRegister(this.lastPong)
    }
  }

  private async authenticateAndSendRegister(pong: PongResponse): Promise<void> {
    if (!this.controlSocket || !this.controlAddr) return
    this.lastRegisterSentMs = Date.now()

    const signed = await this.callPlayitApi<SignedAgentKeyResponse>('/proto/register', {
      agent_version: null,
      proto_version: PLAYIT_PROTO_VERSION,
      version: PLAYIT_AGENT_VERSION,
      platform: process.platform === 'win32' ? 'windows' : process.platform,
      client_addr: MessageCodec.formatSocketAddr(pong.clientAddr),
      tunnel_addr: MessageCodec.formatSocketAddr(pong.tunnelAddr)
    })

    if (signed?.key && this.controlSocket && this.controlAddr) {
      const pkt = PlayitProtoCodec.encodeRawRegisterRpc(this.nextReqId(), signed.key)
      this.controlSocket.send(pkt, this.controlAddr.port, this.controlAddr.ip)
    }
  }

  private handleControlDatagram(msg: Buffer, _rinfo: dgram.RemoteInfo): void {
    try {
      const feed = PlayitProtoCodec.decodeControlFeed(msg)
      if (feed.type === 'Response') {
        const resp = feed.response
        if (resp.type === 'Pong') {
          const pong = resp.data
          this.lastPong = pong
          this.lastPongRxMs = Date.now()
          const rtt = Math.max(1, Date.now() - Number(pong.requestNow))
          if (rtt < 10_000) {
            this.currentLatencyMs = rtt
            this.state.tunnels.forEach((t) => {
              t.latencyMs = rtt
            })
          }

          if (!this.sessionId && Date.now() - this.lastRegisterSentMs > 2_000) {
            this.authenticateAndSendRegister(pong).catch((err) => {
              logger.warn(`[PlayitService] /proto/register failed: ${(err as Error).message}`)
              this.state.lastError = (err as Error).message
              this.emitUpdated()
            })
          }
          this.emitUpdated()
        } else if (resp.type === 'AgentRegistered') {
          this.sessionId = resp.data.id
          this.sessionExpiresAt = resp.data.expiresAt
          this.state.controlChannelStatus = 'connected'
          this.state.lastError = undefined
          this.state.tunnels = this.state.tunnels.map((t) => ({
            ...t,
            status: t.publicAddress.startsWith('Pending') ? 'connecting' : 'active'
          }))
          logger.info(
            `[PlayitService] AgentRegistered session=${resp.data.id.sessionId} agent=${resp.data.id.agentId}`
          )
          this.emitUpdated()
        } else if (resp.type === 'UdpChannelDetails') {
          this.udpChannelDetails = resp.data
          this.sendUdpEstablishToken()
        } else if (resp.type === 'Unauthorized' || resp.type === 'InvalidSignature') {
          this.sessionId = null
          if (this.lastPong) {
            this.authenticateAndSendRegister(this.lastPong).catch(() => {})
          }
        }
      } else if (feed.type === 'NewClient') {
        this.handleIncomingTcpClient(feed.newClient)
      }
    } catch (err) {
      logger.debug(`[PlayitService] Failed to decode control packet: ${String(err)}`)
    }
  }

  /**
   * Authentic implementation of `packages/agent_core/src/network/tcp/tcp_clients.rs`:
   * 1. Connect TCP to `claimInstructions.address`
   * 2. Write `claimInstructions.token`
   * 3. Read 8-byte confirmation (`expect_buffer = [0u8; 8]`)
   * 4. Connect TCP to local server `localIp:(localPort + portOffset)` and pipe bidirectionally
   */
  private handleIncomingTcpClient(newClient: NewClientEvent): void {
    const tunnel =
      this.state.tunnels.find(
        (t) => t.internalId !== undefined && BigInt(t.internalId) === newClient.tunnelId
      ) ||
      this.state.tunnels.find((t) => t.localPort === newClient.connectAddr.port) ||
      this.state.tunnels[0]

    if (!tunnel || tunnel.status === 'paused') {
      logger.warn(
        `[PlayitService] NewClient for unknown/paused tunnelId=${newClient.tunnelId}, dropping`
      )
      return
    }

    const targetIp = tunnel.localIp || '127.0.0.1'
    const targetPort = tunnel.localPort + (newClient.portOffset || 0)

    const claimConn = net.createConnection({
      host: newClient.claimInstructions.address.ip,
      port: newClient.claimInstructions.address.port
    })
    claimConn.setNoDelay(true)
    this.activeTcpSockets.add(claimConn)

    let ackBuffer = Buffer.alloc(0)
    let claimed = false
    let didIncrement = false
    let cleanedUp = false
    let localConn: net.Socket | null = null

    const cleanup = (): void => {
      if (cleanedUp) return
      cleanedUp = true
      this.activeTcpSockets.delete(claimConn)
      if (didIncrement) {
        didIncrement = false
        tunnel.activeConnections = Math.max(0, tunnel.activeConnections - 1)
        this.emitUpdated()
      }
      if (localConn) {
        this.activeTcpSockets.delete(localConn)
        localConn.destroy()
      }
      claimConn.destroy()
    }

    claimConn.on('connect', () => {
      claimConn.write(newClient.claimInstructions.token)
    })

    claimConn.on('data', (chunk: Buffer) => {
      if (!claimed) {
        ackBuffer = Buffer.concat([ackBuffer, chunk])
        if (ackBuffer.length < 8) return
        claimed = true
        const leftover = ackBuffer.subarray(8)
        ackBuffer = Buffer.alloc(0)

        didIncrement = true
        tunnel.activeConnections += 1
        this.emitUpdated()

        localConn = net.createConnection({ host: targetIp, port: targetPort })
        localConn.setNoDelay(true)
        this.activeTcpSockets.add(localConn)

        localConn.on('connect', () => {
          if (leftover.length > 0 && localConn) {
            tunnel.bytesIn += leftover.length
            localConn.write(leftover)
          }
        })

        localConn.on('data', (outChunk: Buffer) => {
          tunnel.bytesOut += outChunk.length
          if (!claimConn.destroyed) {
            claimConn.write(outChunk)
          }
        })

        localConn.on('error', cleanup)
        localConn.on('close', cleanup)
        return
      }

      if (localConn && !localConn.destroyed) {
        tunnel.bytesIn += chunk.length
        localConn.write(chunk)
      }
    })

    claimConn.on('error', cleanup)
    claimConn.on('close', cleanup)
  }

  private maintainUdpChannel(): void {
    if (!this.udpChannelDetails || !this.udpChannelSocket) return
    this.sendUdpEstablishToken()

    const now = Date.now()
    for (const [key, client] of this.virtualUdpClients.entries()) {
      if (now - client.lastActiveMs > 60_000) {
        try {
          client.socket.close()
        } catch {
          // ignore if already closed
        }
        this.virtualUdpClients.delete(key)
      }
    }
  }

  private sendUdpEstablishToken(): void {
    if (!this.udpChannelDetails || !this.udpChannelSocket) return
    const { tunnelAddr, token } = this.udpChannelDetails
    this.udpChannelSocket.send(token, tunnelAddr.port, tunnelAddr.ip)
  }

  private handleUdpChannelDatagram(packet: Buffer, rinfo: dgram.RemoteInfo): void {
    if (!this.udpChannelDetails) return
    if (
      rinfo.address !== this.udpChannelDetails.tunnelAddr.ip ||
      rinfo.port !== this.udpChannelDetails.tunnelAddr.port
    ) {
      return
    }

    const parsed = PlayitProtoCodec.parseUdpFlowFromTail(packet)
    if (parsed.type === 'establish') {
      this.udpEstablishRxEpochMs = Date.now()
      return
    }
    if (parsed.type !== 'flow') return

    const { flow, payload } = parsed
    const tunnelId = flow.extension?.tunnelId
    const portOffset = flow.extension?.portOffset || 0

    const tunnel =
      (tunnelId !== undefined &&
        this.state.tunnels.find(
          (t) => t.internalId !== undefined && BigInt(t.internalId) === tunnelId
        )) ||
      this.state.tunnels.find((t) => t.proto === 'udp' || t.proto === 'both')

    if (!tunnel || tunnel.status === 'paused') return

    tunnel.bytesIn += payload.length
    const targetIp = tunnel.localIp || '127.0.0.1'
    const targetPort = tunnel.localPort + portOffset
    const clientKey = `${flow.src.ip}:${flow.src.port}->${tunnel.id}:${portOffset}`

    let vClient = this.virtualUdpClients.get(clientKey)
    if (!vClient) {
      const sock = dgram.createSocket('udp4')
      vClient = {
        socket: sock,
        flow,
        targetIp,
        targetPort,
        lastActiveMs: Date.now()
      }
      this.virtualUdpClients.set(clientKey, vClient)

      sock.on('message', (originMsg) => {
        if (!this.udpChannelSocket || !this.udpChannelDetails) return
        vClient!.lastActiveMs = Date.now()
        tunnel.bytesOut += originMsg.length
        const framed = PlayitProtoCodec.appendUdpFlowFooter(originMsg, flow)
        this.udpChannelSocket.send(
          framed,
          this.udpChannelDetails.tunnelAddr.port,
          this.udpChannelDetails.tunnelAddr.ip
        )
      })
      sock.on('error', () => {
        try {
          sock.close()
        } catch {
          // ignore if already closed
        }
        this.virtualUdpClients.delete(clientKey)
      })
    }

    vClient.lastActiveMs = Date.now()
    vClient.socket.send(payload, targetPort, targetIp)
  }

  private stopSocketsAndTimers(): void {
    if (this.controlLoopTimer) {
      clearInterval(this.controlLoopTimer)
      this.controlLoopTimer = null
    }
    if (this.rundataTimer) {
      clearInterval(this.rundataTimer)
      this.rundataTimer = null
    }
    if (this.udpEstablishTimer) {
      clearInterval(this.udpEstablishTimer)
      this.udpEstablishTimer = null
    }
    if (this.controlSocket) {
      try {
        this.controlSocket.close()
      } catch {
        // ignore
      }
      this.controlSocket = null
    }
    if (this.udpChannelSocket) {
      try {
        this.udpChannelSocket.close()
      } catch {
        // ignore
      }
      this.udpChannelSocket = null
    }
    for (const sock of this.activeTcpSockets) {
      sock.destroy()
    }
    this.activeTcpSockets.clear()
    for (const client of this.virtualUdpClients.values()) {
      try {
        client.socket.close()
      } catch {
        // ignore
      }
    }
    this.virtualUdpClients.clear()
    this.sessionId = null
    this.lastPong = null
  }

  /**
   * Create a tunnel for a Minecraft server on playit.gg via `POST /v1/tunnels/create`.
   * Requires a linked playit.gg account so that a real public address is allocated.
   */
  public async createOrEnableTunnel(
    serverId: string,
    proto: 'tcp' | 'udp' | 'both' = 'tcp'
  ): Promise<PlayitState> {
    const server = this.config.getServer(serverId)
    if (!server) throw new Error('Server not found')

    if (!this.secretKey || !this.state.linked) {
      await this.startClaimFlow(true)
      this.state.lastError =
        'Playit.gg account required: opened claim link in your browser. Approve the agent on playit.gg, then click Enable Tunnel again.'
      this.emitUpdated()
      return this.getState()
    }

    try {
      if (
        !this.controlSocket ||
        this.state.controlChannelStatus === 'disconnected' ||
        this.state.controlChannelStatus === 'error'
      ) {
        await this.startAgent()
      }

      if (!this.state.agentId) {
        const runData = await this.callPlayitApi<AgentRunDataV1>('/v1/agents/rundata', {})
        this.state.agentId = runData.agent_id
      }

      // Check if a tunnel already exists for this server port or id
      const existing = this.state.tunnels.find(
        (t) => t.serverId === serverId || t.localPort === server.port
      )
      if (existing) {
        if (existing.status === 'paused') {
          return await this.toggleTunnel(existing.id)
        }
        this.state.lastError = undefined
        this.emitUpdated()
        return this.getState()
      }

      const tunnelType =
        proto === 'tcp' ? 'minecraft-java' : proto === 'udp' ? 'minecraft-bedrock' : null

      try {
        await this.callPlayitApi<{ id: string }>('/tunnels/create', {
          name: server.name,
          tunnel_type: tunnelType,
          tunnel_description: null,
          port_type: proto,
          port_count: 1,
          origin: {
            type: 'agent',
            data: {
              agent_id: this.state.agentId,
              local_ip: '127.0.0.1',
              local_port: server.port
            }
          },
          enabled: true,
          alloc: null,
          firewall_id: null,
          proxy_protocol: null
        })
      } catch (err1) {
        logger.warn(
          `[PlayitService] /tunnels/create with tunnel_type failed, retrying generic port: ${(err1 as Error).message}`
        )
        await this.callPlayitApi<{ id: string }>('/tunnels/create', {
          name: server.name,
          tunnel_type: null,
          tunnel_description: null,
          port_type: proto,
          port_count: 1,
          origin: {
            type: 'agent',
            data: {
              agent_id: this.state.agentId,
              local_ip: '127.0.0.1',
              local_port: server.port
            }
          },
          enabled: true,
          alloc: null,
          firewall_id: null,
          proxy_protocol: null
        })
      }

      const runData = await this.callPlayitApi<AgentRunDataV1>('/v1/agents/rundata', {})
      this.syncTunnelsFromRunData(runData)
      this.state.lastError = undefined
      this.emitUpdated()
      return this.getState()
    } catch (err) {
      this.state.lastError = `Failed to create tunnel on playit.gg: ${(err as Error).message}`
      this.emitUpdated()
      return this.getState()
    }
  }

  public async toggleTunnel(tunnelId: string): Promise<PlayitState> {
    const tun = this.state.tunnels.find((t) => t.id === tunnelId)
    if (!tun) return this.getState()

    const nextEnabled = tun.status === 'paused'
    if (this.secretKey && this.state.linked) {
      try {
        await this.callPlayitApi('/tunnels/enable', {
          tunnel_id: tunnelId,
          enabled: nextEnabled
        })
        const runData = await this.callPlayitApi<AgentRunDataV1>('/v1/agents/rundata', {})
        this.syncTunnelsFromRunData(runData)
      } catch (err) {
        this.state.lastError = (err as Error).message
        this.emitUpdated()
      }
    }
    return this.getState()
  }

  public async deleteTunnel(tunnelId: string): Promise<PlayitState> {
    const tun = this.state.tunnels.find((t) => t.id === tunnelId)
    if (this.secretKey && this.state.linked) {
      try {
        await this.callPlayitApi('/tunnels/delete', { tunnel_id: tunnelId })
      } catch (err) {
        logger.warn(`[PlayitService] /tunnels/delete warning: ${(err as Error).message}`)
      }
    }
    if (tun) {
      const srv = this.config.getServer(tun.serverId)
      if (srv) {
        srv.playitTunnelId = undefined
        srv.playitPublicAddress = undefined
        this.config.upsertServer(srv)
      }
    }
    this.state.tunnels = this.state.tunnels.filter((t) => t.id !== tunnelId)
    this.emitUpdated()
    return this.getState()
  }

  public shutdown(): void {
    if (this.claimPollTimer) {
      clearInterval(this.claimPollTimer)
      this.claimPollTimer = null
    }
    this.stopSocketsAndTimers()
  }
}
