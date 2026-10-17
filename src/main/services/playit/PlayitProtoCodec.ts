import net from 'net'

/**
 * Authentic TypeScript port of playit-cloud/playit-agent:
 * - crates.io `message-encoding = "0.2.2"` binary serializer/deserializer
 * - `playit-agent-proto` (`control_messages.rs`, `control_feed.rs`, `rpc.rs`, `udp_proto.rs`)
 * Runs 100% in-process inside BlockHost's Electron main process without any external binary.
 */
export const PLAYIT_AGENT_VERSION = {
  variant_id: '308943e8-faef-4835-a2ba-270351f72aa3',
  version_major: 1,
  version_minor: 0,
  version_patch: 12
}
export const PLAYIT_PROTO_VERSION = 2

export enum ControlRequestId {
  _PingV1 = 1,
  _AgentRegisterV1 = 2,
  AgentKeepAliveV1 = 3,
  SetupUdpChannelV1 = 4,
  _AgentCheckPortMappingV1 = 5,
  PingV2 = 6,
  _AgentRegisterV2 = 7
}

export enum ControlResponseId {
  Pong = 1,
  InvalidSignature = 2,
  Unauthorized = 3,
  RequestQueued = 4,
  TryAgainLater = 5,
  AgentRegistered = 6,
  AgentPortMapping = 7,
  UdpChannelDetails = 8
}

export enum ControlFeedId {
  Response = 1,
  NewClientOld = 2,
  NewClient = 3
}

export const UDP_CHANNEL_ESTABLISH_ID = 0xd01fe6830dd07875n
export const REDIRECT_FLOW_4_FOOTER_ID_OLD = 0x5c261298840392a5n
export const REDIRECT_FLOW_6_FOOTER_ID_OLD = 0x66789678273566ffn
export const REDIRECT_FLOW_4_FOOTER_ID = 0x4368616e55647034n
export const REDIRECT_FLOW_6_FOOTER_ID = 0x4368616e55647036n

export interface SocketAddress {
  ip: string
  port: number
  family: 4 | 6
}

export interface AgentSessionId {
  sessionId: bigint
  accountId: bigint
  agentId: bigint
}

export interface PingRequest {
  now: bigint
  currentPing?: number | null
  sessionId?: AgentSessionId | null
}

export interface PongResponse {
  requestNow: bigint
  serverNow: bigint
  serverId: bigint
  dataCenterId: number
  clientAddr: SocketAddress
  tunnelAddr: SocketAddress
  sessionExpireAt?: bigint | null
}

export interface AgentRegisteredResponse {
  id: AgentSessionId
  expiresAt: bigint
}

export interface UdpChannelDetailsResponse {
  tunnelAddr: SocketAddress
  token: Buffer
}

export interface ClaimInstructions {
  address: SocketAddress
  token: Buffer
}

export interface NewClientEvent {
  peerAddr: SocketAddress
  connectAddr: SocketAddress
  claimInstructions: ClaimInstructions
  tunnelServerId: bigint
  dataCenterId: number
  tunnelId: bigint
  portOffset: number
}

export type ControlResponse =
  | { type: 'Pong'; data: PongResponse }
  | { type: 'InvalidSignature' }
  | { type: 'Unauthorized' }
  | { type: 'RequestQueued' }
  | { type: 'TryAgainLater' }
  | { type: 'AgentRegistered'; data: AgentRegisteredResponse }
  | { type: 'UdpChannelDetails'; data: UdpChannelDetailsResponse }
  | { type: 'AgentPortMapping' }

export type ControlFeed =
  | {
      type: 'Response'
      requestId: bigint
      response: ControlResponse
    }
  | {
      type: 'NewClient'
      newClient: NewClientEvent
    }

export interface UdpFlowExtension {
  tunnelId: bigint
  portOffset: number
}

export interface UdpFlow {
  family: 4 | 6
  src: SocketAddress
  dst: SocketAddress
  extension?: UdpFlowExtension
}

/**
 * Exact implementation of `message-encoding = "0.2.2"` binary reader/writer.
 */
export class MessageCodec {
  public static parseIpv4(ip: string): Buffer {
    const parts = ip.trim().split('.').map((n) => parseInt(n, 10))
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
      throw new Error(`Invalid IPv4 address: ${ip}`)
    }
    return Buffer.from(parts)
  }

  public static formatIpv4(buf: Buffer, offset = 0): string {
    return `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`
  }

  public static parseIpv6(ip: string): Buffer {
    const clean = ip.replace(/^\[|\]$/g, '').trim()
    const out = Buffer.alloc(16, 0)
    const doubleColonIdx = clean.indexOf('::')
    if (doubleColonIdx !== -1) {
      const left = clean.slice(0, doubleColonIdx)
      const right = clean.slice(doubleColonIdx + 2)
      const leftParts = left ? left.split(':') : []
      const rightParts = right ? right.split(':') : []
      for (let i = 0; i < leftParts.length; i++) {
        out.writeUInt16BE(parseInt(leftParts[i], 16) || 0, i * 2)
      }
      for (let i = 0; i < rightParts.length; i++) {
        const idx = 8 - rightParts.length + i
        out.writeUInt16BE(parseInt(rightParts[i], 16) || 0, idx * 2)
      }
      return out
    }
    const parts = clean.split(':')
    for (let i = 0; i < Math.min(8, parts.length); i++) {
      out.writeUInt16BE(parseInt(parts[i], 16) || 0, i * 2)
    }
    return out
  }

  public static formatIpv6(buf: Buffer, offset = 0): string {
    const groups: number[] = []
    for (let i = 0; i < 8; i++) {
      groups.push(buf.readUInt16BE(offset + i * 2))
    }
    // Compress longest run of zeros per standard IPv6 formatting
    let bestStart = -1
    let bestLen = 0
    let curStart = -1
    let curLen = 0
    for (let i = 0; i < 8; i++) {
      if (groups[i] === 0) {
        if (curStart === -1) {
          curStart = i
          curLen = 1
        } else {
          curLen++
        }
        if (curLen > bestLen && curLen >= 2) {
          bestLen = curLen
          bestStart = curStart
        }
      } else {
        curStart = -1
        curLen = 0
      }
    }
    if (bestStart !== -1) {
      const left = groups.slice(0, bestStart).map((g) => g.toString(16)).join(':')
      const right = groups.slice(bestStart + bestLen).map((g) => g.toString(16)).join(':')
      return `${left}::${right}`
    }
    return groups.map((g) => g.toString(16)).join(':')
  }

  public static parseSocketAddr(str: string): SocketAddress {
    const trimmed = str.trim()
    if (trimmed.startsWith('[')) {
      const closeBracket = trimmed.indexOf(']')
      const ip = trimmed.slice(1, closeBracket)
      const port = parseInt(trimmed.slice(closeBracket + 2), 10)
      return { ip, port, family: 6 }
    }
    const lastColon = trimmed.lastIndexOf(':')
    const ip = trimmed.slice(0, lastColon)
    const port = parseInt(trimmed.slice(lastColon + 1), 10)
    const family = net.isIPv6(ip) ? 6 : 4
    return { ip, port, family }
  }

  public static formatSocketAddr(addr: SocketAddress): string {
    return addr.family === 6 ? `[${addr.ip}]:${addr.port}` : `${addr.ip}:${addr.port}`
  }

  public static writeSocketAddr(addr: SocketAddress): Buffer {
    if (addr.family === 6 || net.isIPv6(addr.ip)) {
      const buf = Buffer.alloc(1 + 16 + 2)
      buf.writeUInt8(6, 0)
      MessageCodec.parseIpv6(addr.ip).copy(buf, 1)
      buf.writeUInt16BE(addr.port, 17)
      return buf
    } else {
      const buf = Buffer.alloc(1 + 4 + 2)
      buf.writeUInt8(4, 0)
      MessageCodec.parseIpv4(addr.ip).copy(buf, 1)
      buf.writeUInt16BE(addr.port, 5)
      return buf
    }
  }

  public static readSocketAddr(buf: Buffer, offset: number): { value: SocketAddress; nextOffset: number } {
    if (offset >= buf.length) throw new Error('Unexpected EOF reading SocketAddr tag')
    const tag = buf.readUInt8(offset)
    if (tag === 4) {
      if (offset + 7 > buf.length) throw new Error('Unexpected EOF reading SocketAddrV4')
      const ip = MessageCodec.formatIpv4(buf, offset + 1)
      const port = buf.readUInt16BE(offset + 5)
      return { value: { ip, port, family: 4 }, nextOffset: offset + 7 }
    } else if (tag === 6) {
      if (offset + 19 > buf.length) throw new Error('Unexpected EOF reading SocketAddrV6')
      const ip = MessageCodec.formatIpv6(buf, offset + 1)
      const port = buf.readUInt16BE(offset + 17)
      return { value: { ip, port, family: 6 }, nextOffset: offset + 19 }
    }
    throw new Error(`Invalid SocketAddr ip type: ${tag}`)
  }

  public static writeVecU8(data: Buffer): Buffer {
    const header = Buffer.alloc(8)
    header.writeBigUInt64BE(BigInt(data.length), 0)
    return Buffer.concat([header, data])
  }

  public static readVecU8(buf: Buffer, offset: number): { value: Buffer; nextOffset: number } {
    if (offset + 8 > buf.length) throw new Error('Unexpected EOF reading Vec<u8> len')
    const len = Number(buf.readBigUInt64BE(offset))
    if (len < 0 || offset + 8 + len > buf.length) {
      throw new Error(`Unexpected EOF reading Vec<u8> of length ${len}`)
    }
    return {
      value: Buffer.from(buf.subarray(offset + 8, offset + 8 + len)),
      nextOffset: offset + 8 + len
    }
  }

  public static writeAgentSessionId(id: AgentSessionId): Buffer {
    const buf = Buffer.alloc(24)
    buf.writeBigUInt64BE(id.sessionId, 0)
    buf.writeBigUInt64BE(id.accountId, 8)
    buf.writeBigUInt64BE(id.agentId, 16)
    return buf
  }

  public static readAgentSessionId(buf: Buffer, offset: number): { value: AgentSessionId; nextOffset: number } {
    if (offset + 24 > buf.length) throw new Error('Unexpected EOF reading AgentSessionId')
    return {
      value: {
        sessionId: buf.readBigUInt64BE(offset),
        accountId: buf.readBigUInt64BE(offset + 8),
        agentId: buf.readBigUInt64BE(offset + 16)
      },
      nextOffset: offset + 24
    }
  }
}

export class PlayitProtoCodec {
  /**
   * Wrap a ControlRequest body in a ControlRpcMessage with an 8-byte BigEndian request_id.
   */
  public static wrapRpcRequest(requestId: bigint, requestBody: Buffer): Buffer {
    const header = Buffer.alloc(8)
    header.writeBigUInt64BE(requestId, 0)
    return Buffer.concat([header, requestBody])
  }

  /**
   * Encode ControlRequest::Ping (PingV2 = 6) wrapped in ControlRpcMessage.
   */
  public static encodePingRpc(requestId: bigint, ping: PingRequest): Buffer {
    const parts: Buffer[] = []
    const header = Buffer.alloc(8 + 4 + 8)
    header.writeBigUInt64BE(requestId, 0)
    header.writeUInt32BE(ControlRequestId.PingV2, 8)
    header.writeBigUInt64BE(ping.now, 12)
    parts.push(header)

    if (ping.currentPing !== undefined && ping.currentPing !== null) {
      const optPing = Buffer.alloc(5)
      optPing.writeUInt8(1, 0)
      optPing.writeUInt32BE(ping.currentPing, 1)
      parts.push(optPing)
    } else {
      parts.push(Buffer.from([0]))
    }

    if (ping.sessionId) {
      parts.push(Buffer.from([1]))
      parts.push(MessageCodec.writeAgentSessionId(ping.sessionId))
    } else {
      parts.push(Buffer.from([0]))
    }

    return Buffer.concat(parts)
  }

  /**
   * Encode legacy ControlRequest::_PingV1 (id = 1) wrapped in ControlRpcMessage (used in upstream test vector).
   */
  public static encodePingV1Rpc(requestId: bigint, ping: { now: bigint; currentPing?: number | null }): Buffer {
    const parts: Buffer[] = []
    const header = Buffer.alloc(8 + 4 + 8)
    header.writeBigUInt64BE(requestId, 0)
    header.writeUInt32BE(ControlRequestId._PingV1, 8)
    header.writeBigUInt64BE(ping.now, 12)
    parts.push(header)

    if (ping.currentPing !== undefined && ping.currentPing !== null) {
      const optPing = Buffer.alloc(5)
      optPing.writeUInt8(1, 0)
      optPing.writeUInt32BE(ping.currentPing, 1)
      parts.push(optPing)
    } else {
      parts.push(Buffer.from([0]))
    }
    return Buffer.concat(parts)
  }

  /**
   * Encode ControlRequest::AgentKeepAlive (AgentKeepAliveV1 = 3) wrapped in ControlRpcMessage.
   */
  public static encodeAgentKeepAliveRpc(requestId: bigint, sessionId: AgentSessionId): Buffer {
    const header = Buffer.alloc(12)
    header.writeBigUInt64BE(requestId, 0)
    header.writeUInt32BE(ControlRequestId.AgentKeepAliveV1, 8)
    return Buffer.concat([header, MessageCodec.writeAgentSessionId(sessionId)])
  }

  /**
   * Encode ControlRequest::SetupUdpChannel (SetupUdpChannelV1 = 4) wrapped in ControlRpcMessage.
   */
  public static encodeSetupUdpChannelRpc(requestId: bigint, sessionId: AgentSessionId): Buffer {
    const header = Buffer.alloc(12)
    header.writeBigUInt64BE(requestId, 0)
    header.writeUInt32BE(ControlRequestId.SetupUdpChannelV1, 8)
    return Buffer.concat([header, MessageCodec.writeAgentSessionId(sessionId)])
  }

  /**
   * Encode signed register bytes returned by POST /proto/register wrapped in ControlRpcMessage.
   * Upstream `established_control.rs` sends `ControlRpcMessage { request_id, content: RawSlice(&bytes) }`.
   */
  public static encodeRawRegisterRpc(requestId: bigint, signedKeyHex: string): Buffer {
    const raw = Buffer.from(signedKeyHex.trim(), 'hex')
    return PlayitProtoCodec.wrapRpcRequest(requestId, raw)
  }

  /**
   * Decode incoming UDP datagram from playit control server (`ControlFeed::read_from`).
   */
  public static decodeControlFeed(packet: Buffer): ControlFeed {
    if (packet.length < 4) {
      throw new Error('ControlFeed packet too short')
    }
    const feedId = packet.readUInt32BE(0) as ControlFeedId
    let offset = 4

    if (feedId === ControlFeedId.Response) {
      if (offset + 12 > packet.length) {
        throw new Error('ControlRpcMessage Response too short')
      }
      const requestId = packet.readBigUInt64BE(offset)
      offset += 8
      const respId = packet.readUInt32BE(offset) as ControlResponseId
      offset += 4

      switch (respId) {
        case ControlResponseId.Pong: {
          const requestNow = packet.readBigUInt64BE(offset)
          offset += 8
          const serverNow = packet.readBigUInt64BE(offset)
          offset += 8
          const serverId = packet.readBigUInt64BE(offset)
          offset += 8
          const dataCenterId = packet.readUInt32BE(offset)
          offset += 4
          const clientRes = MessageCodec.readSocketAddr(packet, offset)
          offset = clientRes.nextOffset
          const tunnelRes = MessageCodec.readSocketAddr(packet, offset)
          offset = tunnelRes.nextOffset
          const optTag = packet.readUInt8(offset)
          offset += 1
          let sessionExpireAt: bigint | null = null
          if (optTag === 1) {
            sessionExpireAt = packet.readBigUInt64BE(offset)
            offset += 8
          }
          return {
            type: 'Response',
            requestId,
            response: {
              type: 'Pong',
              data: {
                requestNow,
                serverNow,
                serverId,
                dataCenterId,
                clientAddr: clientRes.value,
                tunnelAddr: tunnelRes.value,
                sessionExpireAt
              }
            }
          }
        }
        case ControlResponseId.InvalidSignature:
          return { type: 'Response', requestId, response: { type: 'InvalidSignature' } }
        case ControlResponseId.Unauthorized:
          return { type: 'Response', requestId, response: { type: 'Unauthorized' } }
        case ControlResponseId.RequestQueued:
          return { type: 'Response', requestId, response: { type: 'RequestQueued' } }
        case ControlResponseId.TryAgainLater:
          return { type: 'Response', requestId, response: { type: 'TryAgainLater' } }
        case ControlResponseId.AgentRegistered: {
          const idRes = MessageCodec.readAgentSessionId(packet, offset)
          offset = idRes.nextOffset
          const expiresAt = packet.readBigUInt64BE(offset)
          return {
            type: 'Response',
            requestId,
            response: {
              type: 'AgentRegistered',
              data: {
                id: idRes.value,
                expiresAt
              }
            }
          }
        }
        case ControlResponseId.UdpChannelDetails: {
          const addrRes = MessageCodec.readSocketAddr(packet, offset)
          offset = addrRes.nextOffset
          const tokenRes = MessageCodec.readVecU8(packet, offset)
          return {
            type: 'Response',
            requestId,
            response: {
              type: 'UdpChannelDetails',
              data: {
                tunnelAddr: addrRes.value,
                token: tokenRes.value
              }
            }
          }
        }
        case ControlResponseId.AgentPortMapping:
          return { type: 'Response', requestId, response: { type: 'AgentPortMapping' } }
        default:
          throw new Error(`Invalid ControlResponse id: ${respId}`)
      }
    }

    if (feedId === ControlFeedId.NewClient) {
      const peerRes = MessageCodec.readSocketAddr(packet, offset)
      offset = peerRes.nextOffset
      const connRes = MessageCodec.readSocketAddr(packet, offset)
      offset = connRes.nextOffset
      const claimAddrRes = MessageCodec.readSocketAddr(packet, offset)
      offset = claimAddrRes.nextOffset
      const claimTokenRes = MessageCodec.readVecU8(packet, offset)
      offset = claimTokenRes.nextOffset
      const tunnelServerId = packet.readBigUInt64BE(offset)
      offset += 8
      const dataCenterId = packet.readUInt32BE(offset)
      offset += 4
      const tunnelId = packet.readBigUInt64BE(offset)
      offset += 8
      const portOffset = packet.readUInt16BE(offset)
      return {
        type: 'NewClient',
        newClient: {
          peerAddr: peerRes.value,
          connectAddr: connRes.value,
          claimInstructions: {
            address: claimAddrRes.value,
            token: claimTokenRes.value
          },
          tunnelServerId,
          dataCenterId,
          tunnelId,
          portOffset
        }
      }
    }

    if (feedId === ControlFeedId.NewClientOld) {
      const connectRes = MessageCodec.readSocketAddr(packet, offset)
      offset = connectRes.nextOffset
      const peerRes = MessageCodec.readSocketAddr(packet, offset)
      offset = peerRes.nextOffset
      const claimAddrRes = MessageCodec.readSocketAddr(packet, offset)
      offset = claimAddrRes.nextOffset
      const claimTokenRes = MessageCodec.readVecU8(packet, offset)
      offset = claimTokenRes.nextOffset
      const tunnelServerId = packet.readBigUInt64BE(offset)
      offset += 8
      const dataCenterId = packet.readUInt32BE(offset)
      return {
        type: 'NewClient',
        newClient: {
          peerAddr: peerRes.value,
          connectAddr: connectRes.value,
          claimInstructions: {
            address: claimAddrRes.value,
            token: claimTokenRes.value
          },
          tunnelServerId,
          dataCenterId,
          tunnelId: 0n,
          portOffset: 0
        }
      }
    }

    throw new Error(`Invalid ControlFeed id: ${feedId}`)
  }

  /**
   * Append UdpFlow footer to a UDP payload (`UdpFlow::write_to` in `udp_proto.rs`).
   */
  public static appendUdpFlowFooter(payload: Buffer, flow: UdpFlow): Buffer {
    if (flow.family === 4) {
      const footerLen = flow.extension ? 30 : 20
      const footer = Buffer.alloc(footerLen)
      MessageCodec.parseIpv4(flow.src.ip).copy(footer, 0)
      MessageCodec.parseIpv4(flow.dst.ip).copy(footer, 4)
      footer.writeUInt16BE(flow.src.port, 8)
      footer.writeUInt16BE(flow.dst.port, 10)
      if (flow.extension) {
        footer.writeBigUInt64BE(flow.extension.tunnelId, 12)
        footer.writeUInt16BE(flow.extension.portOffset, 20)
        footer.writeBigUInt64BE(REDIRECT_FLOW_4_FOOTER_ID, 22)
      } else {
        footer.writeBigUInt64BE(REDIRECT_FLOW_4_FOOTER_ID_OLD, 12)
      }
      return Buffer.concat([payload, footer])
    } else {
      const footerLen = flow.extension ? 54 : 44
      const footer = Buffer.alloc(footerLen)
      MessageCodec.parseIpv6(flow.src.ip).copy(footer, 0)
      MessageCodec.parseIpv6(flow.dst.ip).copy(footer, 16)
      footer.writeUInt16BE(flow.src.port, 32)
      footer.writeUInt16BE(flow.dst.port, 34)
      if (flow.extension) {
        footer.writeBigUInt64BE(flow.extension.tunnelId, 36)
        footer.writeUInt16BE(flow.extension.portOffset, 44)
        footer.writeBigUInt64BE(REDIRECT_FLOW_6_FOOTER_ID, 46)
      } else {
        footer.writeBigUInt64BE(REDIRECT_FLOW_6_FOOTER_ID_OLD, 36)
      }
      return Buffer.concat([payload, footer])
    }
  }

  /**
   * Parse UdpFlow footer from a received UDP datagram (`UdpFlow::from_tail` in `udp_proto.rs`).
   */
  public static parseUdpFlowFromTail(packet: Buffer):
    | { type: 'establish' }
    | { type: 'flow'; flow: UdpFlow; payload: Buffer }
    | { type: 'invalid'; footerId?: bigint } {
    if (packet.length < 8) {
      return { type: 'invalid' }
    }
    const footerId = packet.readBigUInt64BE(packet.length - 8)
    if (footerId === UDP_CHANNEL_ESTABLISH_ID) {
      return { type: 'establish' }
    }

    if (footerId === REDIRECT_FLOW_4_FOOTER_ID || footerId === REDIRECT_FLOW_4_FOOTER_ID_OLD) {
      const hasExt = footerId === REDIRECT_FLOW_4_FOOTER_ID
      const footerLen = hasExt ? 30 : 20
      if (packet.length < footerLen) return { type: 'invalid', footerId }
      const tailOffset = packet.length - footerLen
      const srcIp = MessageCodec.formatIpv4(packet, tailOffset)
      const dstIp = MessageCodec.formatIpv4(packet, tailOffset + 4)
      const srcPort = packet.readUInt16BE(tailOffset + 8)
      const dstPort = packet.readUInt16BE(tailOffset + 10)
      let extension: UdpFlowExtension | undefined
      if (hasExt) {
        const tunnelId = packet.readBigUInt64BE(tailOffset + 12)
        const portOffset = packet.readUInt16BE(tailOffset + 20)
        extension = { tunnelId, portOffset }
      }
      return {
        type: 'flow',
        flow: {
          family: 4,
          src: { ip: srcIp, port: srcPort, family: 4 },
          dst: { ip: dstIp, port: dstPort, family: 4 },
          extension
        },
        payload: packet.subarray(0, tailOffset)
      }
    }

    if (footerId === REDIRECT_FLOW_6_FOOTER_ID || footerId === REDIRECT_FLOW_6_FOOTER_ID_OLD) {
      const hasExt = footerId === REDIRECT_FLOW_6_FOOTER_ID
      const footerLen = hasExt ? 54 : 44
      if (packet.length < footerLen) return { type: 'invalid', footerId }
      const tailOffset = packet.length - footerLen
      const srcIp = MessageCodec.formatIpv6(packet, tailOffset)
      const dstIp = MessageCodec.formatIpv6(packet, tailOffset + 16)
      const srcPort = packet.readUInt16BE(tailOffset + 32)
      const dstPort = packet.readUInt16BE(tailOffset + 34)
      let extension: UdpFlowExtension | undefined
      if (hasExt) {
        const tunnelId = packet.readBigUInt64BE(tailOffset + 36)
        const portOffset = packet.readUInt16BE(tailOffset + 44)
        extension = { tunnelId, portOffset }
      }
      return {
        type: 'flow',
        flow: {
          family: 6,
          src: { ip: srcIp, port: srcPort, family: 6 },
          dst: { ip: dstIp, port: dstPort, family: 6 },
          extension
        },
        payload: packet.subarray(0, tailOffset)
      }
    }

    return { type: 'invalid', footerId }
  }
}
