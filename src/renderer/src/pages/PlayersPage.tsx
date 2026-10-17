import React, { useEffect, useState } from 'react'
import {
  Users,
  Shield,
  Ban,
  CheckCircle,
  UserPlus,
  Trash2,
  Zap,
  LogOut
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { BanEntry, OpEntry, PlayerEntry, WhitelistEntry } from '../../../shared/types'

interface PlayersPageProps {
  serverId?: string
  hideServerSelector?: boolean
}

export const PlayersPage: React.FC<PlayersPageProps> = ({ serverId, hideServerSelector }) => {
  const { servers, selectedServerId, setSelectedServerId, runtimeStates } = useAppStore()
  const activeId = serverId || selectedServerId || servers[0]?.id
  const server = servers.find((s) => s.id === activeId) || servers[0]

  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [ops, setOps] = useState<OpEntry[]>([])
  const [bans, setBans] = useState<{ players: BanEntry[]; ips: BanEntry[] }>({
    players: [],
    ips: []
  })

  const [newWhitelistName, setNewWhitelistName] = useState('')
  const [newOpName, setNewOpName] = useState('')
  const [newOpLevel, setNewOpLevel] = useState(4)
  const [newBanTarget, setNewBanTarget] = useState('')
  const [newBanReason, setNewBanReason] = useState('Rule violation')
  const [newBanIsIp, setNewBanIsIp] = useState(false)

  const onlinePlayers: PlayerEntry[] =
    (server && runtimeStates[server.id]?.playersOnline) || []

  const loadAll = async () => {
    if (!server) return
    const data = await window.api.getPlayersData(server.id)
    setWhitelist(data.whitelist)
    setOps(data.ops)
    setBans(data.bans)
  }

  useEffect(() => {
    loadAll()
  }, [server?.id])

  if (!server) {
    return (
      <div className="p-8 text-center text-bh-muted text-sm">
        No server selected. Create or select a server to manage players.
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header (optional if inside server view) */}
      {!hideServerSelector && (
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl badge-accent">
              <Users className="w-5 h-5 text-bh-accent" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-bh-text">
                Player Management, Whitelist, Operators & Bans
              </h2>
              <p className="text-xs text-bh-muted">
                Real-time online roster, Mojang UUID resolution, OP levels 1–4, and IP/Player ban lists
              </p>
            </div>
          </div>

          <select
            value={server.id}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs font-bold text-bh-text"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                Server: {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Online Players Bar */}
      <div className="bg-bh-card border border-bh-border rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-bh-text flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Currently Online Players ({onlinePlayers.length} / {server.maxPlayers})
          </h3>
        </div>
        {onlinePlayers.length === 0 ? (
          <p className="text-xs text-bh-muted py-2">No players currently connected to {server.name}.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {onlinePlayers.map((p) => (
              <div
                key={p.name}
                className="bg-bh-panel border border-bh-border rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={`https://mc-heads.net/avatar/${p.name}/36`}
                    alt={p.name}
                    className="w-8 h-8 rounded-lg bg-black/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-bh-text truncate">{p.name}</p>
                    <p className="text-[10px] font-mono text-bh-muted truncate">
                      {p.uuid || 'Online'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => window.api.sendCommand(server.id, `gamemode creative ${p.name}`)}
                    title="Set Creative"
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-bh-text font-mono"
                  >
                    GMC
                  </button>
                  <button
                    onClick={() => window.api.addOp(server.id, p.name, 4).then(setOps)}
                    title="Grant OP"
                    className="p-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-400"
                  >
                    <Zap className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => window.api.sendCommand(server.id, `kick ${p.name} Kicked by Operator`)}
                    title="Kick Player"
                    className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3 Columns: Whitelist | Operators (OP) | Bans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Whitelist Card */}
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 space-y-3 shadow-xl flex flex-col justify-between overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-bh-text flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Whitelist ({whitelist.length})
              </h3>
              <button
                onClick={async () => {
                  const next = !server.whitelistEnabled
                  await window.api.saveServerProperties(server.id, {
                    'white-list': String(next)
                  })
                  window.api.sendCommand(server.id, next ? 'whitelist on' : 'whitelist off')
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg badge-accent font-semibold"
              >
                Toggle Mode
              </button>
            </div>

            {/* Whitelist Input Row (min-w-0 + shrink-0 to prevent box overflow) */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                value={newWhitelistName}
                onChange={(e) => setNewWhitelistName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newWhitelistName.trim()) {
                    setWhitelist(await window.api.addWhitelist(server.id, newWhitelistName.trim()))
                    setNewWhitelistName('')
                  }
                }}
                placeholder="Minecraft username..."
                className="min-w-0 flex-1 bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text focus:outline-none focus:border-bh-accent"
              />
              <button
                onClick={async () => {
                  if (!newWhitelistName.trim()) return
                  setWhitelist(await window.api.addWhitelist(server.id, newWhitelistName.trim()))
                  setNewWhitelistName('')
                }}
                className="shrink-0 px-3 py-1.5 rounded-xl btn-accent text-xs font-bold flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {whitelist.length === 0 ? (
                <p className="text-xs text-bh-muted py-4 text-center">No whitelisted players.</p>
              ) : (
                whitelist.map((w) => (
                  <div
                    key={w.name}
                    className="bg-bh-panel border border-bh-border rounded-xl p-2.5 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-bh-text truncate">{w.name}</p>
                      <p className="text-[10px] font-mono text-bh-muted truncate">{w.uuid}</p>
                    </div>
                    <button
                      onClick={async () =>
                        setWhitelist(await window.api.removeWhitelist(server.id, w.name))
                      }
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Operators (OPs) Card */}
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 space-y-3 shadow-xl flex flex-col justify-between overflow-hidden">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-bh-text flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" /> Server Operators ({ops.length})
            </h3>

            {/* OP Input Row: min-w-0 on input, compact w-28 select, shrink-0 button so button never overflows! */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                value={newOpName}
                onChange={(e) => setNewOpName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newOpName.trim()) {
                    setOps(await window.api.addOp(server.id, newOpName.trim(), newOpLevel))
                    setNewOpName('')
                  }
                }}
                placeholder="Username..."
                className="min-w-0 flex-1 bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text focus:outline-none focus:border-bh-accent"
              />
              <select
                value={newOpLevel}
                onChange={(e) => setNewOpLevel(parseInt(e.target.value, 10))}
                className="w-28 shrink-0 bg-bh-panel border border-bh-border rounded-xl px-2 py-1.5 text-xs text-bh-text"
              >
                <option value={4}>Lvl 4 (Owner)</option>
                <option value={3}>Lvl 3 (Admin)</option>
                <option value={2}>Lvl 2 (GM)</option>
                <option value={1}>Lvl 1 (Mod)</option>
              </select>
              <button
                onClick={async () => {
                  if (!newOpName.trim()) return
                  setOps(await window.api.addOp(server.id, newOpName.trim(), newOpLevel))
                  setNewOpName('')
                }}
                className="shrink-0 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20"
              >
                OP
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {ops.length === 0 ? (
                <p className="text-xs text-bh-muted py-4 text-center">No operators assigned.</p>
              ) : (
                ops.map((o) => (
                  <div
                    key={o.name}
                    className="bg-bh-panel border border-bh-border rounded-xl p-2.5 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-bh-text truncate">
                        {o.name}{' '}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                          Level {o.level}
                        </span>
                      </p>
                      <p className="text-[10px] font-mono text-bh-muted truncate">{o.uuid}</p>
                    </div>
                    <button
                      onClick={async () => setOps(await window.api.removeOp(server.id, o.name))}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bans Card */}
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 space-y-3 shadow-xl flex flex-col justify-between overflow-hidden">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-bh-text flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-400" /> Banned Players & IPs (
              {bans.players.length + bans.ips.length})
            </h3>

            <div className="space-y-2">
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  type="text"
                  value={newBanTarget}
                  onChange={(e) => setNewBanTarget(e.target.value)}
                  placeholder={newBanIsIp ? 'IP address...' : 'Player username...'}
                  className="min-w-0 flex-1 bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text focus:outline-none focus:border-bh-accent"
                />
                <button
                  onClick={() => setNewBanIsIp(!newBanIsIp)}
                  className="shrink-0 px-2.5 py-1.5 rounded-xl bg-bh-panel border border-bh-border text-xs text-bh-muted hover:text-bh-text"
                >
                  {newBanIsIp ? 'IP Mode' : 'User Mode'}
                </button>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  type="text"
                  value={newBanReason}
                  onChange={(e) => setNewBanReason(e.target.value)}
                  placeholder="Reason..."
                  className="min-w-0 flex-1 bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text focus:outline-none focus:border-bh-accent"
                />
                <button
                  onClick={async () => {
                    if (!newBanTarget.trim()) return
                    setBans(
                      await window.api.addBan(
                        server.id,
                        newBanTarget.trim(),
                        newBanReason,
                        newBanIsIp
                      )
                    )
                    setNewBanTarget('')
                  }}
                  className="shrink-0 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-500/20"
                >
                  Ban
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {bans.players.length === 0 && bans.ips.length === 0 ? (
                <p className="text-xs text-bh-muted py-4 text-center">No banned players or IPs.</p>
              ) : (
                <>
                  {bans.players.map((b) => (
                    <div
                      key={b.name}
                      className="bg-bh-panel border border-bh-border rounded-xl p-2.5 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-rose-300 truncate">{b.name}</p>
                        <p className="text-[10px] text-bh-muted truncate">{b.reason}</p>
                      </div>
                      <button
                        onClick={async () =>
                          b.name && setBans(await window.api.removeBan(server.id, b.name, false))
                        }
                        className="text-xs text-bh-accent hover:underline shrink-0"
                      >
                        Pardon
                      </button>
                    </div>
                  ))}
                  {bans.ips.map((b) => (
                    <div
                      key={b.ip}
                      className="bg-bh-panel border border-bh-border rounded-xl p-2.5 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-rose-300 truncate">IP: {b.ip}</p>
                        <p className="text-[10px] text-bh-muted truncate">{b.reason}</p>
                      </div>
                      <button
                        onClick={async () =>
                          b.ip && setBans(await window.api.removeBan(server.id, b.ip, true))
                        }
                        className="text-xs text-bh-accent hover:underline shrink-0"
                      >
                        Pardon
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
