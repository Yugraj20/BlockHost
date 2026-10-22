import React, { useEffect, useState } from 'react'
import {
  Terminal,
  FileText,
  Activity,
  Sliders,
  Cpu,
  Globe,
  Play,
  Square,
  RotateCw,
  FolderOpen,
  RefreshCw,
  Save,
  AlertTriangle,
  Sparkles,
  Check,
  Trash2,
  Plus,
  Download,
  Upload,
  ArrowLeft,
  Puzzle,
  Package,
  FileCode,
  Users,
  History,
  Wifi,
  Search,
  LayoutGrid,
  List,
  MoreVertical,
  Settings,
  Server
} from 'lucide-react'
import { useAppStore, ServerSubTab } from '../stores/useAppStore'
import { ConsolePanel } from '../components/ConsolePanel'
import { Sparkline } from '../components/Sparkline'
import { ModrinthPage } from './ModrinthPage'
import { FilesPage } from './FilesPage'
import { BackupsPage } from './BackupsPage'
import { PlayersPage } from './PlayersPage'
import { NetworkPage } from './NetworkPage'
import { DEFAULT_SERVER_PROPERTIES, AIKAR_FLAGS } from '../../../shared/constants'
import { WorldInfo } from '../../../shared/types'
import { getRamMilestones } from '../utils/ramMilestones'

export const ServersPage: React.FC = () => {
  const {
    servers,
    selectedServerId,
    setSelectedServerId,
    viewingServerId,
    openServerDetail,
    closeServerDetail,
    runtimeStates,
    activeServerSubTab,
    setActiveServerSubTab,
    setActiveTab,
    refreshServers,
    systemMetrics
  } = useAppStore()

  const totalSystemRamGb = Math.max(
    4,
    Math.round((systemMetrics?.ramTotalBytes ?? 16 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024))
  )
  const ramMilestones = React.useMemo(() => getRamMilestones(totalSystemRamGb), [totalSystemRamGb])
  const minRamLimitMb = ramMilestones[0].value
  const maxRamLimitMb = ramMilestones[ramMilestones.length - 1].value

  // Directory View state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({})

  // Server Detail View state
  const currentServerId = viewingServerId || selectedServerId || servers[0]?.id
  const server = servers.find((s) => s.id === currentServerId)
  const state = server ? runtimeStates[server.id] : undefined

  // Logs state
  const [logFiles, setLogFiles] = useState<{ name: string; relPath: string; size: number; modifiedAt: number }[]>([])
  const [selectedLogPath, setSelectedLogPath] = useState('logs/latest.log')
  const [logContent, setLogContent] = useState('')
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL')
  const [logSearch, setLogSearch] = useState('')

  // Server Properties state
  const [propsMap, setPropsMap] = useState<Record<string, string>>({})
  const [rawPropsMode, setRawPropsMode] = useState(false)
  const [rawPropsText, setRawPropsText] = useState('')
  const [propsSaved, setPropsSaved] = useState(false)

  // Worlds state
  const [worlds, setWorlds] = useState<WorldInfo[]>([])

  // JVM & Autorestart state
  const [ramMb, setRamMb] = useState(server?.ramMb || 4096)
  const [minRamMb, setMinRamMb] = useState(server?.minRamMb || 2048)
  const [aikarFlags, setAikarFlags] = useState(server?.aikarFlags ?? true)
  const [jvmArgs, setJvmArgs] = useState(server?.jvmArgs || '')
  const [javaPath, setJavaPath] = useState(server?.javaPath || 'auto')
  const [port, setPort] = useState(server?.port || 25565)
  const [autoStart, setAutoStart] = useState(server?.autoStart ?? false)
  const [autoRestartOnCrash, setAutoRestartOnCrash] = useState(server?.autoRestartOnCrash ?? true)
  const [autoRestartMaxRetries, setAutoRestartMaxRetries] = useState(server?.autoRestartMaxRetries ?? 3)
  const [autoRestartRamLimitPercent, setAutoRestartRamLimitPercent] = useState(
    server?.autoRestartRamLimitPercent ?? 0
  )
  const [autoRestartScheduleCron, setAutoRestartScheduleCron] = useState(
    server?.autoRestartScheduleCron ?? ''
  )
  const [jvmSaved, setJvmSaved] = useState(false)

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setMenuOpenId(null)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!server) return
    setRamMb(server.ramMb)
    setMinRamMb(server.minRamMb)
    setAikarFlags(server.aikarFlags)
    setJvmArgs(server.jvmArgs)
    setJavaPath(server.javaPath)
    setPort(server.port)
    setAutoStart(server.autoStart)
    setAutoRestartOnCrash(server.autoRestartOnCrash)
    setAutoRestartMaxRetries(server.autoRestartMaxRetries)
    setAutoRestartRamLimitPercent(server.autoRestartRamLimitPercent)
    setAutoRestartScheduleCron(server.autoRestartScheduleCron)

    if (activeServerSubTab === 'logs') {
      window.api.listLogs(server.id).then((list) => {
        setLogFiles(list)
        const target = list[0]?.relPath || 'logs/latest.log'
        setSelectedLogPath(target)
        window.api
          .readFile(server.id, target)
          .then(setLogContent)
          .catch(() => setLogContent('No log file generated yet. Start the server first.'))
      })
    } else if (activeServerSubTab === 'properties') {
      window.api.getServerProperties(server.id).then((p) => {
        setPropsMap(p)
        setRawPropsText(
          Object.entries(p)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n')
        )
      })
    } else if (activeServerSubTab === 'worlds') {
      window.api.listWorlds(server.id).then(setWorlds)
    }
  }, [server?.id, activeServerSubTab])

  const handleServerAction = async (
    e: React.MouseEvent,
    srvId: string,
    action: 'start' | 'stop' | 'restart'
  ) => {
    e.stopPropagation()
    setActionBusy((p) => ({ ...p, [srvId]: true }))
    try {
      if (action === 'start') await window.api.startServer(srvId)
      if (action === 'stop') await window.api.stopServer(srvId)
      if (action === 'restart') await window.api.restartServer(srvId)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setActionBusy((p) => ({ ...p, [srvId]: false }))
    }
  }

  const handleSaveProperties = async () => {
    if (!server) return
    let nextProps = { ...propsMap }
    if (rawPropsMode) {
      nextProps = {}
      for (const line of rawPropsText.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq > 0) nextProps[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
      }
    }
    await window.api.saveServerProperties(server.id, nextProps)
    await refreshServers()
    setPropsSaved(true)
    setTimeout(() => setPropsSaved(false), 1800)
  }

  const handleSaveJvmConfig = async () => {
    if (!server) return
    await window.api.updateServer({
      ...server,
      ramMb,
      minRamMb,
      aikarFlags,
      jvmArgs,
      javaPath,
      port,
      autoStart,
      autoRestartOnCrash,
      autoRestartMaxRetries,
      autoRestartRamLimitPercent,
      autoRestartScheduleCron
    })
    await refreshServers()
    setJvmSaved(true)
    setTimeout(() => setJvmSaved(false), 1800)
  }

  // =========================================================================
  // VIEW 1: CLEAN SERVER DIRECTORY LIST (Requirement #5)
  // When viewingServerId is null, ONLY list servers — no logs, no console clutter.
  // =========================================================================
  if (!viewingServerId) {
    const filteredServers = servers.filter((s) => {
      const matchQuery =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.software.toLowerCase().includes(search.toLowerCase()) ||
        s.version.toLowerCase().includes(search.toLowerCase())
      const st = runtimeStates[s.id]?.status || 'offline'
      const isOnline = st === 'online' || st === 'starting'
      if (statusFilter === 'online' && !isOnline) return false
      if (statusFilter === 'offline' && isOnline) return false
      return matchQuery
    })

    return (
      <div className="p-5 space-y-5 animate-fade-in">
        {/* Top Header Bar */}
        <div className="bg-bh-card border border-bh-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl badge-accent">
              <Server className="w-6 h-6 text-bh-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-extrabold text-bh-text">Minecraft Servers</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full badge-accent font-bold">
                  {servers.length} {servers.length === 1 ? 'Instance' : 'Instances'}
                </span>
              </div>
              <p className="text-xs text-bh-muted mt-0.5">
                Click any server to enter its management hub (Console, Mods, Datapacks, Files, Players, Backups)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                const picked = await window.api.pickImportTarget()
                if (!picked) return
                const imported = await window.api.importServer(picked)
                await refreshServers()
                openServerDetail(imported.id, 'console')
              }}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-bh-text border border-bh-border text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" /> Import Server
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className="px-4 py-2 rounded-xl btn-accent text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" /> Create New Server
            </button>
          </div>
        </div>

        {/* Filters and View Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-bh-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, software, version..."
                className="bg-bh-card border border-bh-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-bh-text placeholder:text-bh-muted focus:outline-none focus:border-bh-accent w-64"
              />
            </div>

            <div className="flex bg-bh-card border border-bh-border rounded-xl p-0.5">
              {(['all', 'online', 'offline'] as const).map((sf) => (
                <button
                  key={sf}
                  onClick={() => setStatusFilter(sf)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                    statusFilter === sf
                      ? 'btn-accent font-bold'
                      : 'text-bh-muted hover:text-bh-text'
                  }`}
                >
                  {sf}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center bg-bh-card border border-bh-border rounded-xl p-0.5">
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

        {/* Server Cards / Table */}
        {filteredServers.length === 0 ? (
          <div className="rounded-2xl bg-bh-card border border-dashed border-bh-border p-12 text-center space-y-3">
            <Server className="w-10 h-10 text-bh-accent mx-auto opacity-75" />
            <div>
              <h4 className="text-sm font-bold text-bh-text">No Minecraft Servers Found</h4>
              <p className="text-xs text-bh-muted mt-1 max-w-md mx-auto">
                No servers match your current search or filter criteria. Create a server or import an existing server directory/ZIP.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 rounded-xl btn-accent text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Create Server
              </button>
            </div>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
                : 'flex flex-col gap-3'
            }
          >
            {filteredServers.map((srv) => {
              const st = runtimeStates[srv.id]?.status || 'offline'
              const isOnline = st === 'online'
              const isStarting = st === 'starting' || st === 'installing'
              const playersCount = runtimeStates[srv.id]?.playersOnline?.length || 0
              const busy = actionBusy[srv.id]

              return (
                <div
                  key={srv.id}
                  onClick={() => openServerDetail(srv.id)}
                  className="card-hover group rounded-2xl bg-bh-card border border-bh-border cursor-pointer flex flex-col justify-between shadow-lg relative"
                >
                  {/* Thumbnail Banner Header (Overflow contained to image only) */}
                  <div className="relative h-28 rounded-t-2xl">
                    <div className="absolute inset-0 overflow-hidden rounded-t-2xl">
                      <img
                        src={`./backgrounds/${srv.thumbnail || 'bg-1'}.jpg`}
                        alt={srv.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-bh-card via-black/20 to-black/40" />
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
                          className="absolute right-0 mt-1 w-44 bg-bh-panel/95 backdrop-blur-md border border-bh-border rounded-xl shadow-2xl py-1 z-50 text-xs animate-fade-in"
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
                  <div className="p-4 pt-3 flex flex-col justify-between flex-1 gap-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-bh-text truncate">{srv.name}</h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-amber-300 font-semibold font-mono uppercase">
                          {srv.software} {srv.version}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-bh-muted mt-2">
                        <span>
                          Port <span className="font-mono text-bh-text font-bold">{srv.port}</span>
                        </span>
                        <span>
                          RAM <span className="font-mono text-bh-text font-bold">{(srv.ramMb / 1024).toFixed(1)} GB</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-bh-muted" /> {playersCount}/{srv.maxPlayers}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-bh-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={busy || isOnline || isStarting}
                          onClick={(e) => handleServerAction(e, srv.id, 'start')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                            isOnline || isStarting
                              ? 'bg-white/5 text-bh-muted cursor-not-allowed opacity-50'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" /> Start
                        </button>
                        <button
                          disabled={busy || (!isOnline && !isStarting)}
                          onClick={(e) => handleServerAction(e, srv.id, 'stop')}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 disabled:opacity-40 text-bh-text hover:text-rose-300 border border-bh-border text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <Square className="w-3 h-3 fill-current" /> Stop
                        </button>
                        <button
                          disabled={busy}
                          onClick={(e) => handleServerAction(e, srv.id, 'restart')}
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-bh-text border border-bh-border text-xs transition"
                          title="Restart Server"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openServerDetail(srv.id)
                        }}
                        className="px-3 py-1.5 rounded-xl btn-accent text-xs font-bold flex items-center gap-1"
                      >
                        Manage →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: SERVER DETAIL & MANAGEMENT HUB (Requirement #6)
  // When viewingServerId is active, renders that server's options inside Server tab:
  // Subtabs: Console, Logs, Mods & Plugins, Data Packs, Modpacks, Files, Players,
  //          Backups, Worlds, Performance, Properties, JVM, Network.
  // =========================================================================
  if (!server) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-bh-muted">Server not found or was removed.</p>
        <button onClick={closeServerDetail} className="px-4 py-2 rounded-xl btn-accent text-xs font-bold">
          ← Back to All Servers
        </button>
      </div>
    )
  }

  const isOnline = state?.status === 'online'
  const isStarting = state?.status === 'starting' || state?.status === 'installing'

  const filteredLogLines = logContent
    .split(/\r?\n/)
    .filter((l) => {
      if (logFilter !== 'ALL' && !l.includes(logFilter)) return false
      if (logSearch && !l.toLowerCase().includes(logSearch.toLowerCase())) return false
      return true
    })

  const SUB_TABS: { id: ServerSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'console', label: 'Console', icon: Terminal },
    { id: 'logs', label: 'Logs', icon: FileText },
    { id: 'addons', label: 'Mods & Plugins', icon: Puzzle },
    { id: 'datapacks', label: 'Data Packs', icon: FileCode },
    { id: 'modpacks', label: 'Modpacks', icon: Package },
    { id: 'files', label: 'File Manager', icon: FolderOpen },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'backups', label: 'Backups & Tasks', icon: History },
    { id: 'worlds', label: 'Worlds', icon: Globe },
    { id: 'monitoring', label: 'Performance', icon: Activity },
    { id: 'properties', label: 'server.properties', icon: Sliders },
    { id: 'jvm', label: 'JVM & Autorestart', icon: Cpu },
    { id: 'network', label: 'Tunnel & Network', icon: Wifi }
  ]

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Top Server Control & Identity Bar */}
      <div className="bg-bh-card border border-bh-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <button
            onClick={closeServerDetail}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-bh-muted hover:text-bh-text border border-bh-border transition"
            title="Back to All Servers"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <img
            src={`./backgrounds/${server.thumbnail || 'bg-1'}.jpg`}
            alt={server.name}
            className="w-12 h-12 rounded-xl object-cover border border-white/10"
          />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-bh-text">{server.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-amber-300 font-mono font-bold uppercase">
                {server.software} {server.version}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize flex items-center gap-1.5 ${
                  isOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : isStarting
                      ? 'bg-amber-500/20 text-amber-300'
                      : state?.status === 'crashed'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-white/5 text-bh-muted'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-current'
                  }`}
                />
                {state?.status || 'offline'}
              </span>
            </div>

            <p className="text-xs text-bh-muted mt-0.5">
              Port <span className="font-mono text-bh-text font-bold">{server.port}</span> •{' '}
              {(server.ramMb / 1024).toFixed(1)} GB Heap • {state?.playersOnline.length || 0}/
              {server.maxPlayers} Players Online • TPS:{' '}
              <span className="text-emerald-400 font-bold">{state?.tps ?? 20.0}</span>
            </p>
          </div>
        </div>

        {/* Server Actions */}
        <div className="flex items-center gap-2">
          <button
            disabled={isOnline || isStarting}
            onClick={() => window.api.startServer(server.id)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Start
          </button>
          <button
            disabled={!isOnline && !isStarting}
            onClick={() => window.api.stopServer(server.id)}
            className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5 fill-current" /> Stop
          </button>
          <button
            onClick={() => window.api.restartServer(server.id)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-bh-text border border-bh-border text-xs font-semibold flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" /> Restart
          </button>
          <button
            onClick={() => window.api.openPath(server.directory)}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-bh-muted hover:text-bh-text border border-bh-border text-xs flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Folder
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs (Inside Server Hub) */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-bh-border pb-3">
        {SUB_TABS.map((t) => {
          const Icon = t.icon
          const active = activeServerSubTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveServerSubTab(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                active
                  ? 'btn-accent font-bold'
                  : 'bg-bh-card text-bh-muted hover:text-bh-text border border-bh-border hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ================================================================= */}
      {/* SUB-TABS ROUTING                                                 */}
      {/* ================================================================= */}

      {/* SUB-TAB: CONSOLE */}
      {activeServerSubTab === 'console' && (
        <ConsolePanel serverId={server.id} serverName={server.name} />
      )}

      {/* SUB-TAB: LOGS VIEWER */}
      {activeServerSubTab === 'logs' && (
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={selectedLogPath}
                onChange={(e) => {
                  setSelectedLogPath(e.target.value)
                  window.api.readFile(server.id, e.target.value).then(setLogContent)
                }}
                className="bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text"
              >
                {logFiles.length === 0 ? (
                  <option value="logs/latest.log">logs/latest.log</option>
                ) : (
                  logFiles.map((lf) => (
                    <option key={lf.relPath} value={lf.relPath}>
                      {lf.name} ({(lf.size / 1024).toFixed(1)} KB)
                    </option>
                  ))
                )}
              </select>

              {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLogFilter(lvl)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    logFilter === lvl
                      ? 'btn-accent font-bold'
                      : 'bg-bh-panel text-bh-muted border border-bh-border'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search inside log file..."
              className="bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text w-64 focus:outline-none focus:border-bh-accent"
            />
          </div>

          <div className="h-[460px] overflow-y-auto bg-[#05070d] rounded-xl p-4 font-mono text-xs text-slate-300 space-y-0.5 select-text border border-bh-border">
            {filteredLogLines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: MODS & PLUGINS */}
      {activeServerSubTab === 'addons' && (
        <ModrinthPage defaultMode="addons" serverId={server.id} hideServerSelector />
      )}

      {/* SUB-TAB: DATA PACKS */}
      {activeServerSubTab === 'datapacks' && (
        <ModrinthPage defaultMode="datapack" serverId={server.id} hideServerSelector />
      )}

      {/* SUB-TAB: MODPACKS */}
      {activeServerSubTab === 'modpacks' && (
        <ModrinthPage defaultMode="modpack" serverId={server.id} hideServerSelector />
      )}

      {/* SUB-TAB: FILES */}
      {activeServerSubTab === 'files' && (
        <FilesPage serverId={server.id} hideServerSelector />
      )}

      {/* SUB-TAB: PLAYERS */}
      {activeServerSubTab === 'players' && (
        <PlayersPage serverId={server.id} hideServerSelector />
      )}

      {/* SUB-TAB: BACKUPS & SCHEDULES */}
      {activeServerSubTab === 'backups' && (
        <BackupsPage serverId={server.id} hideServerSelector />
      )}

      {/* SUB-TAB: WORLDS */}
      {activeServerSubTab === 'worlds' && (
        <div className="bg-bh-card border border-bh-border rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-bh-text">World & Dimension Manager</h3>
              <p className="text-xs text-bh-muted">
                Active level-name: <span className="text-bh-accent font-mono font-bold">{server.levelName}</span>
              </p>
            </div>
            <button
              onClick={async () => {
                const name = prompt('Enter folder name for imported world:', 'world')
                if (!name) return
                const ok = await window.api.importWorld(server.id, name)
                if (ok) setWorlds(await window.api.listWorlds(server.id))
              }}
              className="px-3.5 py-2 rounded-xl btn-accent text-xs font-bold flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Import World ZIP
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {worlds.map((w) => (
              <div
                key={w.folderName}
                className="bg-bh-panel border border-bh-border rounded-xl p-4 flex flex-col justify-between gap-3 card-hover"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-bh-text">{w.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full badge-accent uppercase font-bold">
                      {w.dimension}
                    </span>
                  </div>
                  <p className="text-xs text-bh-muted mt-1 font-mono">
                    Size: {(w.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.api.exportWorld(server.id, w.folderName)}
                    className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-bh-text border border-bh-border flex items-center justify-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Export ZIP
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        confirm(
                          `Reset world "${w.folderName}"? This will wipe chunks and regenerate on next start.`
                        )
                      ) {
                        await window.api.resetWorld(server.id, w.folderName)
                        setWorlds(await window.api.listWorlds(server.id))
                      }
                    }}
                    className="py-1.5 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-xs text-rose-300 border border-rose-500/30 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Reset
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: PERFORMANCE & MONITORING */}
      {activeServerSubTab === 'monitoring' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-bh-card border border-bh-border rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-bh-muted">Process CPU Load</span>
                <span className="text-lg font-extrabold text-bh-accent">
                  {state?.cpuPercent ?? 0}%
                </span>
              </div>
              <Sparkline data={(state?.history || []).map((h) => h.cpu)} color="var(--bh-accent)" height={70} />
            </div>

            <div className="bg-bh-card border border-bh-border rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-bh-muted">JVM Memory Heap</span>
                <span className="text-lg font-extrabold text-cyan-400">
                  {state?.ramUsedMb ?? 0} / {server.ramMb} MB
                </span>
              </div>
              <Sparkline data={(state?.history || []).map((h) => h.ramMb)} color="#06b6d4" height={70} />
            </div>

            <div className="bg-bh-card border border-bh-border rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-bh-muted">Server Tick Rate (TPS)</span>
                <span className="text-lg font-extrabold text-violet-400">
                  {state?.tps ?? 20.0} TPS
                </span>
              </div>
              <Sparkline data={(state?.history || []).map((h) => h.tps)} color="#8b5cf6" height={70} />
            </div>
          </div>

          <div className="bg-bh-card border border-bh-border rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-bh-text flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Crash Recovery & Diagnostic Report
              </h4>
              <span className="text-xs text-bh-muted">
                Crash counter: <strong>{state?.crashLoopCount ?? 0}</strong> /{' '}
                {server.autoRestartMaxRetries}
              </span>
            </div>

            {state?.lastCrashReport ? (
              <pre className="bg-[#05070d] p-4 rounded-xl text-xs font-mono text-rose-300 overflow-x-auto max-h-64 border border-bh-border">
                {state.lastCrashReport}
              </pre>
            ) : (
              <p className="text-xs text-bh-muted py-2">
                No crash reports recorded for this server. Automatic crash recovery is{' '}
                <span className="text-bh-accent font-semibold">
                  {server.autoRestartOnCrash ? 'ENABLED' : 'DISABLED'}
                </span>
                .
              </p>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB: SERVER.PROPERTIES */}
      {activeServerSubTab === 'properties' && (
        <div className="bg-bh-card border border-bh-border rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-bh-text">server.properties Configuration</h3>
              <p className="text-xs text-bh-muted">
                Edit structured settings or switch to raw key-value mode.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRawPropsMode(!rawPropsMode)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-bh-text border border-bh-border"
              >
                {rawPropsMode ? 'Structured Form View' : 'Raw Text Editor'}
              </button>
              <button
                onClick={handleSaveProperties}
                className="px-4 py-1.5 rounded-xl btn-accent text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                {propsSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {propsSaved ? 'Saved!' : 'Save Properties'}
              </button>
            </div>
          </div>

          {rawPropsMode ? (
            <textarea
              value={rawPropsText}
              onChange={(e) => setRawPropsText(e.target.value)}
              className="w-full h-96 bg-[#05070d] border border-bh-border rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-bh-accent"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {Object.entries(DEFAULT_SERVER_PROPERTIES).map(([key, meta]) => {
                const currentVal = propsMap[key] ?? meta.value
                const isBool = currentVal === 'true' || currentVal === 'false'
                return (
                  <div
                    key={key}
                    className="bg-bh-panel border border-bh-border rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-bold text-bh-accent">{key}</p>
                      <p className="text-[11px] text-bh-muted truncate">{meta.description}</p>
                    </div>
                    {isBool ? (
                      <select
                        value={currentVal}
                        onChange={(e) => setPropsMap({ ...propsMap, [key]: e.target.value })}
                        className="bg-bh-card border border-bh-border rounded-lg px-2.5 py-1 text-xs text-bh-text"
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={currentVal}
                        onChange={(e) => setPropsMap({ ...propsMap, [key]: e.target.value })}
                        className="bg-bh-card border border-bh-border rounded-lg px-2.5 py-1 text-xs text-bh-text w-40 font-mono"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: JVM, PORTS & AUTORESTART */}
      {activeServerSubTab === 'jvm' && (
        <div className="bg-bh-card border border-bh-border rounded-2xl p-5 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-bh-text">
              JVM Memory, Ports & Autorestart Policies
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.api.reinstallJar(server.id)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-bh-text border border-bh-border flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" /> Re-download Server JAR
              </button>
              <button
                onClick={handleSaveJvmConfig}
                className="px-4 py-1.5 rounded-xl btn-accent text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                {jvmSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {jvmSaved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="bg-bh-panel p-4 rounded-xl border border-bh-border space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-bh-muted">Maximum Heap Memory (-Xmx)</span>
                  <span className="font-bold text-bh-accent">
                    {ramMb} MB ({(ramMb / 1024).toFixed(1)} GB)
                  </span>
                </div>
                <input
                  type="range"
                  min={minRamLimitMb}
                  max={maxRamLimitMb}
                  step={512}
                  value={ramMb}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setRamMb(val)
                    if (minRamMb > val) setMinRamMb(val)
                  }}
                  className="w-full accent-bh-accent cursor-pointer"
                />
                <div className="relative w-full h-5 mt-1.5">
                  {ramMilestones.map((m, idx) => {
                    const pct = ((m.value - minRamLimitMb) / (maxRamLimitMb - minRamLimitMb)) * 100
                    const isFirst = idx === 0
                    const isLast = idx === ramMilestones.length - 1
                    const isSelected = Math.abs(ramMb - m.value) < 256
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          setRamMb(m.value)
                          if (minRamMb > m.value) setMinRamMb(m.value)
                        }}
                        style={{
                          left: isFirst ? '0%' : isLast ? undefined : `${pct}%`,
                          right: isLast ? '0%' : undefined,
                          transform: isFirst || isLast ? 'none' : 'translateX(-50%)'
                        }}
                        className={`absolute text-[10px] whitespace-nowrap transition-colors cursor-pointer select-none hover:text-bh-accent ${
                          isSelected ? 'text-bh-accent font-bold' : 'text-bh-muted'
                        }`}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>

                <div className="flex justify-between text-xs pt-2">
                  <span className="font-semibold text-bh-muted">Minimum Heap Memory (-Xms)</span>
                  <span className="font-bold text-cyan-400">{minRamMb} MB</span>
                </div>
                <input
                  type="range"
                  min={512}
                  max={ramMb}
                  step={512}
                  value={minRamMb}
                  onChange={(e) => setMinRamMb(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div className="bg-bh-panel p-4 rounded-xl border border-bh-border space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-bh-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aikarFlags}
                    onChange={(e) => setAikarFlags(e.target.checked)}
                    className="accent-bh-accent"
                  />
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Use Aikar&apos;s G1GC Flags Preset
                </label>
                {aikarFlags && (
                  <p className="text-[10px] font-mono text-bh-muted bg-black/30 p-2 rounded-lg break-all">
                    {AIKAR_FLAGS}
                  </p>
                )}

                <label className="block text-xs font-semibold text-bh-muted pt-2">
                  Custom Additional JVM Flags
                </label>
                <input
                  type="text"
                  value={jvmArgs}
                  onChange={(e) => setJvmArgs(e.target.value)}
                  placeholder="-Dpaper.playerconnection.keepalive=60"
                  className="w-full bg-bh-card border border-bh-border rounded-xl px-3 py-1.5 text-xs font-mono text-bh-text"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-bh-panel p-4 rounded-xl border border-bh-border space-y-3">
                <h4 className="text-xs font-bold text-bh-text uppercase tracking-wider">
                  Port & Autostart
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-bh-muted mb-1">TCP/UDP Port</label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(parseInt(e.target.value, 10) || 25565)}
                      className="w-full bg-bh-card border border-bh-border rounded-xl px-3 py-1.5 text-xs font-mono text-bh-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-bh-muted mb-1">Java Runtime Path</label>
                    <input
                      type="text"
                      value={javaPath}
                      onChange={(e) => setJavaPath(e.target.value)}
                      className="w-full bg-bh-card border border-bh-border rounded-xl px-3 py-1.5 text-xs font-mono text-bh-text"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-bh-text pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoStart}
                    onChange={(e) => setAutoStart(e.target.checked)}
                    className="accent-bh-accent"
                  />
                  Automatically start this server when ChunkHarbor launches
                </label>
              </div>

              <div className="bg-bh-panel p-4 rounded-xl border border-bh-border space-y-3">
                <h4 className="text-xs font-bold text-bh-text uppercase tracking-wider">
                  Crash Recovery & Autorestart
                </h4>
                <label className="flex items-center gap-2 text-xs text-bh-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRestartOnCrash}
                    onChange={(e) => setAutoRestartOnCrash(e.target.checked)}
                    className="accent-bh-accent"
                  />
                  Automatically restart if server exits with a crash
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-bh-muted mb-1">Max Crash Retries</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={autoRestartMaxRetries}
                      onChange={(e) => setAutoRestartMaxRetries(parseInt(e.target.value, 10) || 3)}
                      className="w-full bg-bh-card border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-bh-muted mb-1">
                      RAM Restart Limit % (0=Off)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={autoRestartRamLimitPercent}
                      onChange={(e) =>
                        setAutoRestartRamLimitPercent(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full bg-bh-card border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-bh-muted mb-1">
                    Scheduled Restart Cron (e.g. `0 4 * * *` for 4:00 AM daily)
                  </label>
                  <input
                    type="text"
                    value={autoRestartScheduleCron}
                    onChange={(e) => setAutoRestartScheduleCron(e.target.value)}
                    placeholder="Leave empty to disable"
                    className="w-full bg-bh-card border border-bh-border rounded-xl px-3 py-1.5 text-xs font-mono text-bh-text"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: NETWORK & PLAYIT.GG */}
      {activeServerSubTab === 'network' && (
        <NetworkPage serverId={server.id} hideServerSelector />
      )}
    </div>
  )
}
