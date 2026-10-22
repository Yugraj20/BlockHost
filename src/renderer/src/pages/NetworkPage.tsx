import React, { useEffect, useState } from 'react'
import {
  Globe,
  Link2,
  Unlink,
  Copy,
  Check,
  Shield,
  Plus,
  Pause,
  Play,
  Trash2,
  Wifi,
  Activity,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'

interface NetworkPageProps {
  serverId?: string
  hideServerSelector?: boolean
}

export const NetworkPage: React.FC<NetworkPageProps> = ({ serverId, hideServerSelector = false }) => {
  const { servers, playit, systemMetrics, selectedServerId } = useAppStore()
  const activeServerId = serverId || selectedServerId || servers[0]?.id
  const [secretInput, setSecretInput] = useState('')
  const [selectedSrvId, setSelectedSrvId] = useState(activeServerId || '')
  const [proto, setProto] = useState<'tcp' | 'udp' | 'both'>('tcp')
  const [publicIp, setPublicIp] = useState<string>('Detecting...')
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [firewallMsg, setFirewallMsg] = useState('')
  const [creatingTunnel, setCreatingTunnel] = useState(false)
  const [claimLoading, setClaimLoading] = useState(false)

  useEffect(() => {
    window.api.getPublicIp().then(setPublicIp)
  }, [])

  useEffect(() => {
    if (activeServerId) setSelectedSrvId(activeServerId)
  }, [activeServerId])

  const copyAddr = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 1500)
  }

  const handleCreateTunnel = async () => {
    const targetId = selectedSrvId || servers[0]?.id
    if (!targetId) return
    setCreatingTunnel(true)
    try {
      const state = await window.api.createPlayitTunnel(targetId, proto)
      useAppStore.setState({ playit: state })
    } finally {
      setCreatingTunnel(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Built-in playit.gg Banner */}
      <div className="bg-bh-card border border-bh-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl badge-accent">
            <Globe className="w-6 h-6 text-bh-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-bh-text">
                Built-in playit.gg Tunneling & LAN Networking
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full badge-accent font-bold uppercase">
                In-Process Engine ({playit?.protocolVersion || 'playit-ts-proto'})
              </span>
            </div>
            <p className="text-xs text-bh-muted mt-0.5">
              Host public Minecraft servers without port forwarding — runs directly inside VoxelPulse with zero external agent processes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              playit?.linked
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                playit?.linked ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {playit?.linked
              ? `Connected (${playit.agentId})`
              : `Status: ${playit?.controlChannelStatus || 'disconnected'}`}
          </span>
        </div>
      </div>

      {/* Global Error Banner if playit has an error */}
      {playit?.lastError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5 text-xs text-amber-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-bold">Playit.gg Notice</p>
              <p className="mt-0.5 leading-relaxed">{playit.lastError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!playit.linked && (
              <button
                onClick={async () => {
                  setClaimLoading(true)
                  const next = await window.api.startPlayitClaim(true)
                  useAppStore.setState({ playit: next })
                  setClaimLoading(false)
                }}
                className="px-3.5 py-1.5 rounded-xl btn-accent text-xs font-bold shrink-0"
              >
                Link Account Now
              </button>
            )}
            <button
              onClick={() =>
                useAppStore.setState({
                  playit: playit ? { ...playit, lastError: undefined } : null
                })
              }
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-bh-muted hover:text-bh-text text-xs font-semibold transition"
              title="Dismiss Notice"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Account Linking & Tunnel Creation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Account Link Card */}
        <div className="lg:col-span-5 bg-bh-card border border-bh-border rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-bh-text flex items-center gap-2">
            <Link2 className="w-4 h-4 text-bh-accent" /> 1. Account & Agent Key Management
          </h3>

          {playit?.linked ? (
            <div className="bg-bh-panel border border-bh-border rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-bh-muted">Agent Identifier:</span>
                <span className="font-mono font-bold text-bh-accent">{playit.agentId}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-bh-muted">Control Endpoint:</span>
                <span className="font-mono text-bh-text">
                  {playit.controlServerAddress || 'control.playit.gg:5525'}
                </span>
              </div>
              <button
                onClick={async () => {
                  const next = await window.api.unlinkPlayit()
                  useAppStore.setState({ playit: next })
                }}
                className="w-full py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Unlink className="w-3.5 h-3.5" /> Unlink playit.gg Account
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-bh-muted leading-relaxed">
                Click <strong>Generate Claim Link</strong> to connect in your browser, or paste your Agent Secret Key. Keys are encrypted with Windows DPAPI (`safeStorage`).
              </p>

              {playit?.claimCode && (
                <div className="p-3 rounded-xl bg-bh-accentSubtle border border-bh-accentBorder text-xs space-y-1">
                  <p className="text-bh-accent font-bold">
                    Claim Code: <span className="font-mono">{playit.claimCode}</span>
                  </p>
                  <button
                    onClick={() => playit.claimUrl && window.api.openExternal(playit.claimUrl)}
                    className="text-cyan-400 underline text-[11px]"
                  >
                    Open {playit.claimUrl}
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  disabled={claimLoading}
                  onClick={async () => {
                    setClaimLoading(true)
                    const next = await window.api.startPlayitClaim(true)
                    useAppStore.setState({ playit: next })
                    setClaimLoading(false)
                  }}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-bh-text border border-bh-border flex items-center justify-center gap-1.5"
                >
                  {claimLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Generate Claim Link
                </button>
                <button
                  onClick={async () => {
                    const next = await window.api.linkPlayitKey(secretInput || undefined)
                    useAppStore.setState({ playit: next })
                    setSecretInput('')
                  }}
                  className="flex-1 py-2 rounded-xl btn-accent text-xs font-bold"
                >
                  Activate In-App Agent
                </button>
              </div>

              <input
                type="password"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                placeholder="Optional: Paste Agent-Key hex token..."
                className="w-full bg-bh-panel border border-bh-border rounded-xl px-3 py-2 text-xs font-mono text-bh-text focus:outline-none focus:border-bh-accent"
              />
            </div>
          )}

          {/* LAN & Windows Firewall Helper */}
          <div className="pt-3 border-t border-bh-border space-y-3">
            <h4 className="text-xs font-bold text-bh-text uppercase tracking-wider flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" /> LAN & Public Network Endpoints
            </h4>

            <div className="bg-bh-panel border border-bh-border rounded-xl p-3 space-y-2 text-xs">
              {(systemMetrics?.lanIps || ['127.0.0.1']).map((ip) => (
                <div key={ip} className="flex items-center justify-between">
                  <span className="text-bh-muted">LAN IPv4 Address:</span>
                  <button
                    onClick={() => copyAddr(`${ip}:${servers[0]?.port || 25565}`)}
                    className="font-mono font-bold text-cyan-400 flex items-center gap-1"
                  >
                    {ip}:{servers[0]?.port || 25565}
                    {copiedText === `${ip}:${servers[0]?.port || 25565}` ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-bh-muted">Public WAN IP:</span>
                <span className="font-mono text-bh-text">{publicIp}</span>
              </div>
            </div>

            <button
              onClick={async () => {
                const port = servers.find((s) => s.id === selectedSrvId)?.port || 25565
                const res = await window.api.allowFirewallPort(port)
                setFirewallMsg(res.message)
              }}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-bh-border text-xs font-semibold text-bh-text flex items-center justify-center gap-2"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" /> Add Windows Firewall Rule (Port{' '}
              {servers.find((s) => s.id === selectedSrvId)?.port || 25565})
            </button>
            {firewallMsg && <p className="text-[11px] text-emerald-400 font-medium">{firewallMsg}</p>}
          </div>
        </div>

        {/* Active Tunnels List */}
        <div className="lg:col-span-7 bg-bh-card border border-bh-border rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-bh-text flex items-center gap-2">
              <Activity className="w-4 h-4 text-bh-accent" /> 2. Server Tunnels (
              {playit?.tunnels.length || 0})
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              {!hideServerSelector && (
                <select
                  value={selectedSrvId}
                  onChange={(e) => setSelectedSrvId(e.target.value)}
                  className="bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text"
                >
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (:{s.port})
                    </option>
                  ))}
                </select>
              )}
              <select
                value={proto}
                onChange={(e) => setProto(e.target.value as any)}
                className="bg-bh-panel border border-bh-border rounded-xl px-2.5 py-1.5 text-xs text-bh-text"
              >
                <option value="tcp">TCP (Java)</option>
                <option value="udp">UDP (Bedrock/Voice)</option>
                <option value="both">TCP + UDP</option>
              </select>
              <button
                disabled={creatingTunnel}
                onClick={handleCreateTunnel}
                className="px-3.5 py-1.5 rounded-xl btn-accent text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                {creatingTunnel ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Enable Tunnel
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {!playit?.tunnels || playit.tunnels.length === 0 ? (
              <div className="bg-bh-panel border border-dashed border-bh-border rounded-xl p-8 text-center space-y-2">
                <p className="text-xs text-bh-muted">
                  No tunnels active yet. Click <strong>&quot;Enable Tunnel&quot;</strong> above to generate a public join address for your Minecraft server.
                </p>
              </div>
            ) : (
              playit.tunnels.map((tun) => (
                <div
                  key={tun.id}
                  className="bg-bh-panel border border-bh-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 card-hover"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-bh-text">{tun.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          tun.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {tun.status}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-bh-muted uppercase font-mono">
                        {tun.proto} → 127.0.0.1:{tun.localPort}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs font-mono font-bold text-cyan-300 bg-black/40 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                        {tun.publicAddress}
                      </span>
                      <button
                        onClick={() => copyAddr(tun.publicAddress)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-bh-text flex items-center gap-1"
                      >
                        {copiedText === tun.publicAddress ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Join Address
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] text-bh-muted pt-1">
                      Active Connections: <strong>{tun.activeConnections}</strong> • Latency:{' '}
                      <strong>{tun.latencyMs} ms</strong> • Traffic In/Out:{' '}
                      {(tun.bytesIn / 1024).toFixed(1)} KB / {(tun.bytesOut / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        const next = await window.api.togglePlayitTunnel(tun.id)
                        useAppStore.setState({ playit: next })
                      }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-bh-text border border-bh-border"
                      title={tun.status === 'active' ? 'Pause Tunnel' : 'Resume Tunnel'}
                    >
                      {tun.status === 'active' ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={async () => {
                        const next = await window.api.deletePlayitTunnel(tun.id)
                        useAppStore.setState({ playit: next })
                      }}
                      className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                      title="Delete Tunnel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
