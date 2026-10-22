import React, { useEffect, useState } from 'react'
import {
  PlusCircle,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  HardDrive,
  Network,
  Image as ImageIcon,
  Wand2
} from 'lucide-react'
import { ServerSoftware } from '../../../shared/types'
import { useAppStore } from '../stores/useAppStore'
import { getRamMilestones } from '../utils/ramMilestones'

export interface ServerPreset {
  id: string
  name: string
  tagline: string
  software: ServerSoftware
  ramMb: number
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator'
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'
  maxPlayers: number
  motd: string
  aikarFlags: boolean
  thumbnail: string
  badge: string
}

export const SERVER_PRESETS: ServerPreset[] = [
  {
    id: 'survival-friends',
    name: 'Survival with Friends',
    tagline: 'Paper high-performance engine tuned for multiplayer survival',
    software: 'paper',
    ramMb: 4096,
    gamemode: 'survival',
    difficulty: 'normal',
    maxPlayers: 20,
    motd: 'Cozy Survival Realm — Powered by ChunkHarbor',
    aikarFlags: true,
    thumbnail: 'bg-3',
    badge: 'Popular'
  },
  {
    id: 'fabric-modded',
    name: 'Fabric Modded Realm',
    tagline: 'Lightweight, modern mod loader ready for performance mods & shaders',
    software: 'fabric',
    ramMb: 6144,
    gamemode: 'survival',
    difficulty: 'normal',
    maxPlayers: 12,
    motd: 'Modern Fabric Modded World — Powered by ChunkHarbor',
    aikarFlags: true,
    thumbnail: 'bg-7',
    badge: 'Modded'
  },
  {
    id: 'creative-sandbox',
    name: 'Creative & Redstone Lab',
    tagline: 'Peaceful Purpur world with unlimited building and redstone experimentation',
    software: 'purpur',
    ramMb: 4096,
    gamemode: 'creative',
    difficulty: 'peaceful',
    maxPlayers: 15,
    motd: 'Creative Builders & Redstone Lab — Powered by ChunkHarbor',
    aikarFlags: true,
    thumbnail: 'bg-10',
    badge: 'Creative'
  },
  {
    id: 'hardcore-challenge',
    name: 'Hardcore Challenge',
    tagline: 'High-stakes Paper survival on Hard difficulty with one life only',
    software: 'paper',
    ramMb: 4096,
    gamemode: 'survival',
    difficulty: 'hard',
    maxPlayers: 8,
    motd: 'Hardcore Survival Challenge: One Life Only!',
    aikarFlags: true,
    thumbnail: 'bg-14',
    badge: 'Hardcore'
  },
  {
    id: 'vanilla-purist',
    name: 'Pure Vanilla Mojang',
    tagline: 'Unmodified official Mojang server for authentic vanilla mechanics',
    software: 'vanilla',
    ramMb: 2048,
    gamemode: 'survival',
    difficulty: 'normal',
    maxPlayers: 10,
    motd: 'Pure Vanilla Minecraft — Powered by ChunkHarbor',
    aikarFlags: false,
    thumbnail: 'bg-1',
    badge: 'Vanilla'
  }
]

const SOFTWARE_OPTIONS: {
  id: ServerSoftware
  title: string
  badge: string
  desc: string
}[] = [
  {
    id: 'paper',
    title: 'Paper',
    badge: 'Recommended',
    desc: 'High-performance fork of Spigot with full plugin support and optimizations.'
  },
  {
    id: 'vanilla',
    title: 'Vanilla',
    badge: 'Official Mojang',
    desc: 'Unmodified official Minecraft Java Edition server straight from Mojang.'
  },
  {
    id: 'purpur',
    title: 'Purpur',
    badge: 'Extra Features',
    desc: 'Drop-in Paper replacement with extensive gameplay customization.'
  },
  {
    id: 'fabric',
    title: 'Fabric',
    badge: 'Lightweight Mods',
    desc: 'Modern, fast, modular mod loader ideal for performance and content mods.'
  },
  {
    id: 'forge',
    title: 'Forge',
    badge: 'Classic Mods',
    desc: 'The classic Minecraft modding platform supporting large content modpacks.'
  },
  {
    id: 'neoforge',
    title: 'NeoForge',
    badge: 'Modern Forge',
    desc: 'Next-generation evolution of Forge for Minecraft 1.20.1+ and 1.21+.'
  },
  {
    id: 'quilt',
    title: 'Quilt',
    badge: 'Community Loader',
    desc: 'Community-driven mod loader compatible with the Fabric ecosystem.'
  }
]

export const CreateServerPage: React.FC = () => {
  const { refreshServers, openServerDetail, systemMetrics } = useAppStore()

  const totalSystemRamGb = Math.max(
    4,
    Math.round((systemMetrics?.ramTotalBytes ?? 16 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024))
  )
  const ramMilestones = React.useMemo(() => getRamMilestones(totalSystemRamGb), [totalSystemRamGb])
  const minRamMb = ramMilestones[0].value
  const maxRamMb = ramMilestones[ramMilestones.length - 1].value

  const [name, setName] = useState('New Survival World')
  const [software, setSoftware] = useState<ServerSoftware>('paper')
  const [versions, setVersions] = useState<string[]>(['1.21.4', '1.21.1', '1.20.4', '1.20.1'])
  const [version, setVersion] = useState('1.20.4')
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [port, setPort] = useState(25565)
  const [portFree, setPortFree] = useState(true)
  const [ramMb, setRamMb] = useState(4096)
  const [maxPlayers, setMaxPlayers] = useState(20)
  const [motd, setMotd] = useState('A ChunkHarbor Minecraft Server')
  const [gamemode, setGamemode] = useState<'survival' | 'creative' | 'adventure' | 'spectator'>('survival')
  const [difficulty, setDifficulty] = useState<'peaceful' | 'easy' | 'normal' | 'hard'>('normal')
  const [aikarFlags, setAikarFlags] = useState(true)
  const [thumbnail, setThumbnail] = useState('bg-3')
  const [eulaAccepted, setEulaAccepted] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string | null>('survival-friends')

  const applyPreset = (preset: ServerPreset) => {
    setSelectedPreset(preset.id)
    setName(preset.name)
    setSoftware(preset.software)
    const clampedRam = Math.min(Math.max(preset.ramMb, minRamMb), maxRamMb)
    setRamMb(clampedRam)
    setGamemode(preset.gamemode)
    setDifficulty(preset.difficulty)
    setMaxPlayers(preset.maxPlayers)
    setMotd(preset.motd)
    setAikarFlags(preset.aikarFlags)
    setThumbnail(preset.thumbnail)
  }

  useEffect(() => {
    let mounted = true
    setLoadingVersions(true)
    window.api
      .getProviderVersions(software)
      .then((list: string[]) => {
        if (!mounted || !list?.length) return
        setVersions(list)
        if (!list.includes(version)) {
          setVersion(list.includes('1.20.4') ? '1.20.4' : list[0])
        }
      })
      .finally(() => {
        if (mounted) setLoadingVersions(false)
      })
    return () => {
      mounted = false
    }
  }, [software])

  useEffect(() => {
    window.api.nextFreePort(25565).then((freePort) => {
      setPort(freePort)
      setPortFree(true)
    })
  }, [])

  const handlePortChange = async (nextPort: number) => {
    setPort(nextPort)
    const ok = await window.api.checkPort(nextPort)
    setPortFree(ok)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eulaAccepted) {
      setError('Please accept the Minecraft EULA to continue.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const created = await window.api.createServer({
        name,
        software,
        version,
        port,
        ramMb,
        maxPlayers,
        motd,
        gamemode,
        difficulty,
        aikarFlags,
        thumbnail,
        eulaAccepted
      })
      await refreshServers()
      openServerDetail(created.id, 'console')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleImportExisting = async () => {
    const picked = await window.api.pickImportTarget()
    if (!picked) return
    setCreating(true)
    try {
      const imported = await window.api.importServer(picked)
      await refreshServers()
      openServerDetail(imported.id, 'console')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-bh-card/90 border border-bh-border rounded-2xl p-5 shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-bh-text flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-emerald-400" />
            Create or Import Minecraft Server
          </h2>
          <p className="text-xs text-bh-muted mt-1">
            Supports Vanilla, Paper, Purpur, Fabric, Quilt, Forge, and NeoForge with automatic Java runtime selection.
          </p>
        </div>

        <button
          type="button"
          onClick={handleImportExisting}
          className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-bh-text border border-bh-border text-xs font-semibold flex items-center gap-2 transition"
        >
          <Download className="w-4 h-4 text-cyan-400" /> Import Existing Folder or ZIP
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Quick Setup Presets */}
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-3.5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-bh-text">Quick Setup Presets & Templates</h3>
            </div>
            <span className="text-[11px] text-bh-muted">1-click to pre-fill optimal software, memory & gameplay settings</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {SERVER_PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset.id
              return (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between group ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
                      : 'bg-bh-panel border-bh-border hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-xs font-bold text-bh-text group-hover:text-emerald-300 transition-colors">
                        {preset.name}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        isSelected ? 'bg-emerald-500 text-black' : 'bg-white/10 text-slate-300'
                      }`}>
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-bh-muted leading-relaxed mb-3">
                      {preset.tagline}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-2 border-t border-white/5">
                    <span className="capitalize">{preset.software}</span>
                    <span className="text-emerald-400 font-semibold">{preset.ramMb / 1024} GB RAM</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 1: Server Software */}
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-bh-text">1. Select Server Software</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {SOFTWARE_OPTIONS.map((opt) => {
              const active = software === opt.id
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setSoftware(opt.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    active
                      ? 'bg-bh-accentSubtle border-bh-accent ring-1 ring-bh-accentBorder'
                      : 'bg-bh-panel border-bh-border hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-bh-text">{opt.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full badge-accent font-semibold">
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-bh-muted mt-1.5 leading-relaxed">{opt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2: Name, Version, Port, and Memory */}
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-5 shadow-xl">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-bh-text">2. Server Identity & Version</h3>

            <div>
              <label className="block text-xs font-semibold text-bh-muted mb-1">Server Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-bh-panel border border-bh-border rounded-xl px-3.5 py-2 text-sm text-bh-text focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-bh-muted mb-1 flex items-center justify-between">
                  <span>Minecraft Version</span>
                  {loadingVersions && <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />}
                </label>
                <select
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full bg-bh-panel border border-bh-border rounded-xl px-3 py-2 text-sm text-bh-text focus:outline-none focus:border-emerald-500"
                >
                  {versions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-emerald-400/90 mt-1 font-mono flex items-center gap-1">
                  <span>⚡ Requires Java {(() => {
                    const clean = version.replace(/[^0-9.]/g, '')
                    const parts = clean.split('.').map((n) => parseInt(n, 10))
                    const minor = parts[1] || 20
                    const patch = parts[2] || 0
                    if (minor >= 21 || (minor === 20 && patch >= 5)) return 21
                    if (minor >= 17) return 17
                    return 8
                  })()} (Auto-managed Eclipse Temurin)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-bh-muted mb-1">Max Players</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10) || 20)}
                  className="w-full bg-bh-panel border border-bh-border rounded-xl px-3 py-2 text-sm text-bh-text"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-bh-muted mb-1">Game Mode</label>
                <select
                  value={gamemode}
                  onChange={(e) => setGamemode(e.target.value as any)}
                  className="w-full bg-bh-panel border border-bh-border rounded-xl px-3 py-2 text-sm text-bh-text"
                >
                  <option value="survival">Survival</option>
                  <option value="creative">Creative</option>
                  <option value="adventure">Adventure</option>
                  <option value="spectator">Spectator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-bh-muted mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full bg-bh-panel border border-bh-border rounded-xl px-3 py-2 text-sm text-bh-text"
                >
                  <option value="peaceful">Peaceful</option>
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-bh-muted mb-1">MOTD (Server List Message)</label>
              <input
                type="text"
                value={motd}
                onChange={(e) => setMotd(e.target.value)}
                className="w-full bg-bh-panel border border-bh-border rounded-xl px-3.5 py-2 text-xs text-bh-text"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-bh-text">3. Memory, JVM & Port Configuration</h3>

            {/* RAM Slider */}
            <div className="bg-bh-panel/70 p-3.5 rounded-xl border border-bh-border">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-semibold text-bh-muted flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Allocated RAM (-Xmx)
                </span>
                <span className="font-bold text-emerald-400">
                  {ramMb} MB ({(ramMb / 1024).toFixed(1)} GB)
                </span>
              </div>
              <input
                type="range"
                min={minRamMb}
                max={maxRamMb}
                step={512}
                value={ramMb}
                onChange={(e) => setRamMb(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="relative w-full h-5 mt-1.5">
                {ramMilestones.map((m, idx) => {
                  const pct = ((m.value - minRamMb) / (maxRamMb - minRamMb)) * 100
                  const isFirst = idx === 0
                  const isLast = idx === ramMilestones.length - 1
                  const isSelected = Math.abs(ramMb - m.value) < 256
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setRamMb(m.value)}
                      style={{
                        left: isFirst ? '0%' : isLast ? undefined : `${pct}%`,
                        right: isLast ? '0%' : undefined,
                        transform: isFirst || isLast ? 'none' : 'translateX(-50%)'
                      }}
                      className={`absolute text-[10px] whitespace-nowrap transition-colors cursor-pointer select-none hover:text-emerald-400 ${
                        isSelected ? 'text-emerald-400 font-bold' : 'text-bh-muted'
                      }`}
                    >
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Port Configuration */}
            <div className="bg-bh-panel/70 p-3.5 rounded-xl border border-bh-border">
              <label className="block text-xs font-semibold text-bh-muted mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-cyan-400" /> Server Port
                </span>
                <span className={portFree ? 'text-emerald-400' : 'text-amber-400'}>
                  {portFree ? '✓ Port is free' : '⚠ Port in use'}
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  value={port}
                  onChange={(e) => handlePortChange(parseInt(e.target.value, 10) || 25565)}
                  className="flex-1 bg-bh-card border border-bh-border rounded-xl px-3 py-1.5 text-sm text-bh-text font-mono"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const next = await window.api.nextFreePort(port + 1)
                    handlePortChange(next)
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-bh-text border border-bh-border"
                >
                  Find Free Port
                </button>
              </div>
            </div>

            {/* Aikar's Flags & EULA */}
            <div className="space-y-2.5 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-bh-text">
                <input
                  type="checkbox"
                  checked={aikarFlags}
                  onChange={(e) => setAikarFlags(e.target.checked)}
                  className="rounded accent-emerald-500 w-4 h-4"
                />
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Enable Aikar&apos;s G1GC Optimization Flags
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-bh-text">
                <input
                  type="checkbox"
                  checked={eulaAccepted}
                  onChange={(e) => setEulaAccepted(e.target.checked)}
                  className="rounded accent-emerald-500 w-4 h-4"
                />
                <span className="font-medium">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => window.api.openExternal('https://aka.ms/MinecraftEULA')}
                    className="text-emerald-400 underline"
                  >
                    Minecraft End User License Agreement (EULA)
                  </button>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Step 4: Artwork Thumbnail Picker (16 Sliced Collage Backgrounds) */}
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-3 shadow-xl">
          <h3 className="text-sm font-bold text-bh-text flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-emerald-400" /> 4. Choose Server Artwork Banner
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
            {Array.from({ length: 16 }, (_, i) => `bg-${i + 1}`).map((bgId) => (
              <button
                type="button"
                key={bgId}
                onClick={() => setThumbnail(bgId)}
                className={`relative h-14 rounded-xl overflow-hidden border-2 transition ${
                  thumbnail === bgId
                    ? 'border-bh-accent ring-2 ring-bh-accentBorder scale-105'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={`./backgrounds/${bgId}.jpg`}
                  alt={bgId}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-3 rounded-xl btn-accent disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 shadow-xl transition"
          >
            {creating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Installing Server...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Create & Install Server
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
