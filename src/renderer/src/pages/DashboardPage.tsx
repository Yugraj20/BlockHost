import React, { useState, useEffect } from 'react'
import {
  Plus,
  Download,
  Search,
  LayoutGrid,
  List,
  Play,
  Square,
  RotateCw,
  MoreVertical,
  Users,
  Cpu,
  HardDrive,
  Clock,
  Zap,
  ChevronRight,
  Package,
  Puzzle,
  FileCode,
  FolderOpen,
  History,
  Globe,
  Server,
  Trash2,
  Settings
} from 'lucide-react'
import { useAppStore, ServerSubTab } from '../stores/useAppStore'
import { Sparkline } from '../components/Sparkline'
import { ConsolePanel } from '../components/ConsolePanel'

export const DashboardPage: React.FC = () => {
  const {
    servers,
    runtimeStates,
    selectedServerId,
    setSelectedServerId,
    openServerDetail,
    setActiveTab,
    systemMetrics,
    activities,
    settings,
    refreshServers
  } = useAppStore()

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({})

  // Dismiss menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setMenuOpenId(null)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  const selectedServer =
    servers.find((s) => s.id === selectedServerId) || servers[0]
  const selectedState = selectedServer ? runtimeStates[selectedServer.id] : undefined

  const onlineCount = servers.filter(
    (s) => runtimeStates[s.id]?.status === 'online' || runtimeStates[s.id]?.status === 'starting'
  ).length
  const offlineCount = Math.max(0, servers.length - onlineCount)

  const filteredServers = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.software.toLowerCase().includes(search.toLowerCase()) ||
      s.version.toLowerCase().includes(search.toLowerCase())
  )

  const handleImportClick = async () => {
    const picked = await window.api.pickImportTarget()
    if (!picked) return
    await window.api.importServer(picked)
    await refreshServers()
  }

  const handleServerAction = async (
    e: React.MouseEvent,
    serverId: string,
    action: 'start' | 'stop' | 'restart'
  ) => {
    e.stopPropagation()
    setActionBusy((p) => ({ ...p, [serverId]: true }))
    try {
      if (action === 'start') await window.api.startServer(serverId)
      if (action === 'stop') await window.api.stopServer(serverId)
      if (action === 'restart') await window.api.restartServer(serverId)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setActionBusy((p) => ({ ...p, [serverId]: false }))
    }
  }

  const formatUptime = (sec = 0) => {
    if (sec <= 0) return '0h 0m'
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return `${h}h ${m}m`
  }

  const formatRelativeTime = (ts: number) => {
    const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000))
    if (diffSec < 60) return 'Just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`
    return `${Math.floor(diffSec / 86400)} days ago`
  }

  const sysCpu = systemMetrics?.cpuPercent ?? 18
  const sysRamUsedGb = ((systemMetrics?.ramUsedBytes ?? 5.5e9) / 1024 ** 3).toFixed(1)
  const sysRamTotalGb = Math.round((systemMetrics?.ramTotalBytes ?? 16e9) / 1024 ** 3)
  const sysRamPct = Math.min(100, Math.round((parseFloat(sysRamUsedGb) / Math.max(1, sysRamTotalGb)) * 100))

  const sysDiskUsedGb = Math.round((systemMetrics?.diskUsedBytes ?? 120e9) / 1024 ** 3)
  const sysDiskTotalGb = Math.round((systemMetrics?.diskTotalBytes ?? 500e9) / 1024 ** 3)
  const sysDiskPct = Math.min(100, Math.round((sysDiskUsedGb / Math.max(1, sysDiskTotalGb)) * 100))

  const heroArt = settings?.backgroundArt && settings.backgroundArt !== 'none' ? settings.backgroundArt : 'gif'

  return (
    <div className="p-5 grid grid-cols-12 gap-5 animate-fade-in">
      {/* LEFT / CENTER COLUMN (9 cols on xl) */}
      <div className="col-span-12 xl:col-span-9 space-y-5">
        {/* Welcome Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-white/10 h-48 shadow-2xl">
          <img
            src={heroArt === 'gif' ? './Code_Generated_Image.gif' : `./backgrounds/${heroArt}.jpg`}
            alt="Hero Banner"
            className="absolute inset-0 w-full h-full object-cover filter brightness-95"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070b14]/95 via-[#070b14]/75 to-transparent" />
          <div className="relative h-full flex flex-col justify-center px-8">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back!</h2>
            <p className="text-sm text-slate-300 mt-1">
              High-performance Minecraft server operations, network tunneling & instant mod management.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => setActiveTab('create')}
                className="px-5 py-2.5 rounded-xl btn-accent text-white text-sm font-bold flex items-center gap-2 shadow-lg transition"
              >
                <Plus className="w-4 h-4" /> Create Server
              </button>
              <button
                onClick={handleImportClick}
                className="px-5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 text-white text-sm font-semibold border border-white/15 backdrop-blur-md flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4 text-cyan-400" /> Import Server
              </button>
            </div>
          </div>
        </div>

        {/* Your Servers Section */}
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-bh-accent" />
              <h3 className="text-base font-bold text-bh-text">Your Servers</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full badge-accent font-bold">
                {servers.length}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-bh-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search servers..."
                  aria-label="Search Servers"
                  className="bg-bh-panel border border-bh-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-bh-text placeholder:text-bh-muted focus:outline-none focus:border-bh-accent w-56"
                />
              </div>

              <div className="flex items-center bg-bh-panel border border-bh-border rounded-xl p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid View"
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'grid' ? 'bg-white/10 text-bh-text' : 'text-bh-muted'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List View"
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'list' ? 'bg-white/10 text-bh-text' : 'text-bh-muted'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Server Cards Grid / List */}
          {filteredServers.length === 0 ? (
            <div className="rounded-2xl bg-bh-panel border border-dashed border-bh-border p-8 text-center space-y-3">
              <Server className="w-8 h-8 text-bh-accent mx-auto opacity-80" />
              <div>
                <h4 className="text-sm font-bold text-bh-text">No Minecraft Servers Yet</h4>
                <p className="text-xs text-bh-muted mt-1">
                  Create a server to download Vanilla, Paper, Purpur, Fabric, Quilt, Forge, or NeoForge automatically, or import an existing server folder.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 rounded-xl btn-accent text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Server
                </button>
                <button
                  onClick={handleImportClick}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-bh-text border border-bh-border text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" /> Import Server
                </button>
              </div>
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-3 gap-4'
                  : 'flex flex-col gap-3'
              }
            >
              {filteredServers.map((srv) => {
                const st = runtimeStates[srv.id]?.status || 'offline'
                const isOnline = st === 'online'
                const isStarting = st === 'starting' || st === 'installing'
                const playersCount = runtimeStates[srv.id]?.playersOnline?.length || 0
                const isSelected = srv.id === selectedServer?.id
                const busy = actionBusy[srv.id]

                return (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServerId(srv.id)}
                    className={`card-hover group rounded-2xl bg-bh-panel border transition-all cursor-pointer flex flex-col justify-between shadow-lg relative ${
                      isSelected
                        ? 'border-bh-accent ring-1 ring-bh-accent/30'
                        : 'border-bh-border hover:border-white/20'
                    }`}
                  >
                    {/* Thumbnail Header with contained overflow-hidden for image only */}
                    <div className="relative h-28 rounded-t-2xl">
                      <div className="absolute inset-0 overflow-hidden rounded-t-2xl">
                        <img
                          src={`./backgrounds/${srv.thumbnail || 'bg-1'}.jpg`}
                          alt={srv.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-bh-panel via-transparent to-black/40" />
                      </div>

                      {/* Status Badge */}
                      <div className="absolute top-2.5 left-2.5 z-10">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-md shadow ${
                            isOnline
                              ? 'bg-emerald-500/90 text-white'
                              : isStarting
                                ? 'bg-amber-500/90 text-white'
                                : st === 'crashed'
                                  ? 'bg-rose-500/90 text-white'
                                  : 'bg-slate-900/85 text-slate-300 border border-white/15'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-white animate-pulse' : 'bg-current'
                            }`}
                          />
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </span>
                      </div>

                      {/* Context Menu Button & Menu (z-40 + completely unclipped!) */}
                      <div className="absolute top-2.5 right-2.5 z-30">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(menuOpenId === srv.id ? null : srv.id)
                          }}
                          aria-label="Server Options"
                          className="p-1.5 rounded-lg bg-slate-900/85 hover:bg-slate-900 text-white border border-white/15 shadow-md"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {menuOpenId === srv.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-1 w-44 bg-bh-panel border border-bh-border rounded-xl shadow-2xl py-1 z-50 text-xs animate-fade-in"
                          >
                            <button
                              onClick={() => {
                                openServerDetail(srv.id)
                                setMenuOpenId(null)
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-2 text-bh-text font-semibold"
                            >
                              <Settings className="w-3.5 h-3.5 text-bh-accent" /> Manage Server
                            </button>
                            <button
                              onClick={() => {
                                window.api.openPath(srv.directory)
                                setMenuOpenId(null)
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-2 text-bh-text"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" /> Open Folder
                            </button>
                            <button
                              onClick={async () => {
                                setMenuOpenId(null)
                                if (confirm(`Delete server "${srv.name}" and all its files?`)) {
                                  await window.api.deleteServer(srv.id)
                                  await refreshServers()
                                }
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-rose-500/10 flex items-center gap-2 text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Server
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-3.5 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-bh-text truncate">{srv.name}</h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openServerDetail(srv.id)
                          }}
                          className="text-[11px] text-bh-accent hover:underline font-semibold"
                        >
                          Configure →
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-bh-muted mt-1">
                        <span className="capitalize font-medium text-amber-300">
                          ⚡ {srv.software} {srv.version}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {playersCount} / {srv.maxPlayers} players
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-3 gap-2 mt-3.5">
                        <button
                          disabled={busy || isOnline || isStarting}
                          onClick={(e) => handleServerAction(e, srv.id, 'start')}
                          className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
                            isOnline || isStarting
                              ? 'bg-white/5 text-bh-muted opacity-50 cursor-not-allowed'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" /> Start
                        </button>
                        <button
                          disabled={busy || (!isOnline && !isStarting)}
                          onClick={(e) => handleServerAction(e, srv.id, 'stop')}
                          className="py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 disabled:opacity-40 text-bh-text hover:text-rose-300 border border-bh-border text-xs font-semibold flex items-center justify-center gap-1 transition"
                        >
                          <Square className="w-3 h-3 fill-current" /> Stop
                        </button>
                        <button
                          disabled={busy}
                          onClick={(e) => handleServerAction(e, srv.id, 'restart')}
                          className="py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-bh-text border border-bh-border text-xs font-semibold flex items-center justify-center gap-1 transition"
                        >
                          <RotateCw className="w-3 h-3" /> Restart
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 4 Live Sparkline Metric Tiles for Selected Server */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Players Online */}
          <div className="bg-bh-card border border-bh-border rounded-2xl p-4 pb-2 flex flex-col justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl badge-accent">
                <Users className="w-5 h-5 text-bh-accent" />
              </div>
              <div>
                <p className="text-xs text-bh-muted">Players Online</p>
                <p className="text-xl font-extrabold text-bh-text">
                  {selectedState?.playersOnline.length ?? 0}{' '}
                  <span className="text-xs font-normal text-bh-muted">
                    / {selectedServer?.maxPlayers ?? 20}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-2">
              <Sparkline
                data={(selectedState?.history || []).map((h) => h.players)}
                color="var(--bh-accent)"
              />
            </div>
          </div>

          {/* CPU Usage */}
          <div className="bg-bh-card border border-bh-border rounded-2xl p-4 pb-2 flex flex-col justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-bh-muted">CPU Usage</p>
                <p className="text-xl font-extrabold text-bh-text">
                  {selectedState?.cpuPercent ?? 0}%
                </p>
              </div>
            </div>
            <div className="mt-2">
              <Sparkline
                data={(selectedState?.history || []).map((h) => h.cpu)}
                color="#06b6d4"
              />
            </div>
          </div>

          {/* RAM Usage */}
          <div className="bg-bh-card border border-bh-border rounded-2xl p-4 pb-2 flex flex-col justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/15 text-violet-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-bh-muted">RAM Usage</p>
                <p className="text-xl font-extrabold text-bh-text">
                  {((selectedState?.ramUsedMb ?? 0) / 1024).toFixed(1)} GB{' '}
                  <span className="text-xs font-normal text-bh-muted">
                    / {((selectedServer?.ramMb ?? 4096) / 1024).toFixed(0)} GB
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-2">
              <Sparkline
                data={(selectedState?.history || []).map((h) => h.ramMb)}
                color="#8b5cf6"
              />
            </div>
          </div>

          {/* Uptime */}
          <div className="bg-bh-card border border-bh-border rounded-2xl p-4 pb-2 flex flex-col justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-bh-muted">Uptime</p>
                <p className="text-xl font-extrabold text-bh-text">
                  {formatUptime(selectedState?.uptimeSeconds)}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <Sparkline
                data={(selectedState?.history || []).map((h) => h.tps)}
                color="#f59e0b"
              />
            </div>
          </div>
        </div>

        {/* Embedded Server Console */}
        {selectedServer && (
          <ConsolePanel
            serverId={selectedServer.id}
            serverName={selectedServer.name}
            compact
          />
        )}
      </div>

      {/* RIGHT COLUMN (3 cols on xl) */}
      <div className="col-span-12 xl:col-span-3 space-y-5">
        {/* Total Servers Card */}
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl badge-accent">
              <Server className="w-5 h-5 text-bh-accent" />
            </div>
            <div>
              <p className="text-xs text-bh-muted">Total Servers</p>
              <p className="text-2xl font-extrabold text-bh-text">{servers.length}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-bh-muted">
              <span className="text-emerald-400 font-semibold">{onlineCount} Online</span> -{' '}
              {offlineCount} Offline
            </span>
          </div>
        </div>

        {/* System Usage Card */}
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 space-y-3.5 shadow-xl">
          <h3 className="text-sm font-bold text-bh-text">System Usage</h3>

          {/* CPU Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-bh-muted flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-bh-accent" /> CPU
              </span>
              <span className="font-semibold text-bh-text">{sysCpu}%</span>
            </div>
            <div className="h-2 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-bh-accent rounded-full transition-all"
                style={{ width: `${Math.max(6, sysCpu)}%` }}
              />
            </div>
          </div>

          {/* RAM Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-bh-muted flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> RAM
              </span>
              <span className="font-semibold text-bh-text">
                {sysRamUsedGb} / {sysRamTotalGb} GB
              </span>
            </div>
            <div className="h-2 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all"
                style={{ width: `${Math.max(8, sysRamPct)}%` }}
              />
            </div>
          </div>

          {/* Disk Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-bh-muted flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-violet-400" /> Disk
              </span>
              <span className="font-semibold text-bh-text">
                {sysDiskUsedGb} / {sysDiskTotalGb} GB
              </span>
            </div>
            <div className="h-2 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-500 rounded-full transition-all"
                style={{ width: `${Math.max(8, sysDiskPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 space-y-2 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            <h3 className="text-sm font-bold text-bh-text">Quick Actions</h3>
          </div>

          {[
            {
              label: 'Create New Server',
              icon: Plus,
              color: 'text-bh-accent bg-bh-accentSubtle',
              onClick: () => setActiveTab('create')
            },
            {
              label: 'Install Mods & Plugins',
              icon: Puzzle,
              color: 'text-cyan-400 bg-cyan-500/15',
              onClick: () => {
                if (selectedServer) openServerDetail(selectedServer.id, 'addons')
                else setActiveTab('servers')
              }
            },
            {
              label: 'Install Data Packs',
              icon: FileCode,
              color: 'text-amber-400 bg-amber-500/15',
              onClick: () => {
                if (selectedServer) openServerDetail(selectedServer.id, 'datapacks')
                else setActiveTab('servers')
              }
            },
            {
              label: 'Download Modpacks',
              icon: Package,
              color: 'text-violet-400 bg-violet-500/15',
              onClick: () => {
                if (selectedServer) openServerDetail(selectedServer.id, 'modpacks')
                else setActiveTab('servers')
              }
            },
            {
              label: 'Server File Manager',
              icon: FolderOpen,
              color: 'text-amber-400 bg-amber-500/15',
              onClick: () => {
                if (selectedServer) openServerDetail(selectedServer.id, 'files')
                else setActiveTab('servers')
              }
            },
            {
              label: 'Manage Players & OP',
              icon: Users,
              color: 'text-orange-400 bg-orange-500/15',
              onClick: () => {
                if (selectedServer) openServerDetail(selectedServer.id, 'players')
                else setActiveTab('servers')
              }
            },
            {
              label: 'Backups & Snapshots',
              icon: History,
              color: 'text-blue-400 bg-blue-500/15',
              onClick: () => {
                if (selectedServer) openServerDetail(selectedServer.id, 'backups')
                else setActiveTab('servers')
              }
            },
            {
              label: 'Network & playit.gg',
              icon: Globe,
              color: 'text-teal-400 bg-teal-500/15',
              onClick: () => setActiveTab('network')
            }
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-bh-panel hover:bg-white/5 border border-bh-border transition group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-bh-text">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-bh-muted group-hover:translate-x-0.5 transition-transform" />
              </button>
            )
          })}
        </div>

        {/* Recent Activity Card */}
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-bh-text">Recent Activity</h3>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {activities.length === 0 ? (
              <p className="text-xs text-bh-muted py-3 text-center">No recent activities logged.</p>
            ) : (
              activities.slice(0, 8).map((act) => (
                <div key={act.id} className="flex items-start gap-3 text-xs">
                  <div className="w-7 h-7 rounded-lg badge-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Zap className="w-3.5 h-3.5 text-bh-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-bh-text truncate">{act.title}</p>
                    <p className="text-[11px] text-bh-muted truncate">
                      {formatRelativeTime(act.timestamp)}
                    </p>
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
