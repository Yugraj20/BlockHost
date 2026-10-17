import React, { useEffect, useState } from 'react'
import {
  Search,
  Download,
  Puzzle,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  Trash2,
  Power,
  ArrowUpCircle,
  CheckCircle2,
  X,
  FileCode,
  Tag,
  Check
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { ModrinthProject, InstalledAddon, ModrinthVersion } from '../../../shared/types'

interface ModrinthPageProps {
  defaultMode?: 'modpack' | 'addons' | 'datapack' | 'mod' | 'plugin'
  serverId?: string
  hideServerSelector?: boolean
}

export const ModrinthPage: React.FC<ModrinthPageProps> = ({
  defaultMode = 'addons',
  serverId,
  hideServerSelector = false
}) => {
  const { servers, selectedServerId, setSelectedServerId } = useAppStore()
  const activeServerId = serverId || selectedServerId || servers[0]?.id
  const server = servers.find((s) => s.id === activeServerId) || servers[0]

  const isPluginLoader = server?.software === 'paper' || server?.software === 'purpur'

  const getInitialType = (): 'mod' | 'plugin' | 'datapack' | 'modpack' => {
    if (defaultMode === 'modpack') return 'modpack'
    if (defaultMode === 'datapack') return 'datapack'
    if (defaultMode === 'mod') return 'mod'
    if (defaultMode === 'plugin') return 'plugin'
    return isPluginLoader ? 'plugin' : 'mod'
  }

  const [tab, setTab] = useState<'browse' | 'installed'>('browse')
  const [projectType, setProjectType] = useState<'mod' | 'plugin' | 'datapack' | 'modpack'>(getInitialType())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ModrinthProject[]>([])
  const [installed, setInstalled] = useState<InstalledAddon[]>([])
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  // Version Picker Modal state
  const [selectedProjectForVersions, setSelectedProjectForVersions] = useState<ModrinthProject | null>(null)
  const [availableVersions, setAvailableVersions] = useState<ModrinthVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null)

  useEffect(() => {
    if (defaultMode === 'modpack') {
      setProjectType('modpack')
    } else if (defaultMode === 'datapack') {
      setProjectType('datapack')
    }
  }, [defaultMode])

  const loadSearch = async () => {
    if (!server) return
    setLoading(true)
    try {
      const hits = await window.api.searchModrinth({
        query,
        projectType,
        gameVersion: projectType === 'datapack' ? undefined : server.version,
        loader: projectType === 'datapack' ? undefined : server.software
      })
      setResults(hits)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const loadInstalled = async () => {
    if (!server) return
    const list = await window.api.listAddons(server.id)
    setInstalled(list)
  }

  useEffect(() => {
    if (tab === 'browse') loadSearch()
    else loadInstalled()
  }, [server?.id, projectType, tab])

  // Open Version Selection Dialog
  const handleOpenVersions = async (proj: ModrinthProject) => {
    if (!server) return
    setSelectedProjectForVersions(proj)
    setLoadingVersions(true)
    setAvailableVersions([])
    try {
      // First try fetching matching loader & version
      let list = await window.api.getModrinthVersions(
        proj.project_id,
        projectType === 'datapack' ? undefined : server.version,
        projectType === 'datapack' ? undefined : server.software
      )
      // If no versions match strict filters, fetch all available versions for this mod
      if (!list || list.length === 0) {
        list = await window.api.getModrinthVersions(proj.project_id)
      }
      setAvailableVersions(list || [])
    } catch {
      setAvailableVersions([])
    } finally {
      setLoadingVersions(false)
    }
  }

  // Install a specific version chosen by user
  const handleInstallSpecificVersion = async (proj: ModrinthProject, ver: ModrinthVersion) => {
    if (!server) return
    setInstallingVersionId(ver.id)
    setStatusMsg('')
    try {
      if (projectType === 'modpack') {
        const res = await window.api.installModpack({
          serverId: server.id,
          projectId: proj.project_id,
          versionId: ver.id
        })
        setStatusMsg(`Installed modpack "${res.packName}" (${res.installedFiles} files) on ${server.name}!`)
      } else {
        const addon = await window.api.installAddon({
          serverId: server.id,
          projectId: proj.project_id,
          versionId: ver.id,
          type: projectType
        })
        setStatusMsg(`Successfully installed ${addon.name} (v${addon.version})!`)
      }
      await loadInstalled()
      setSelectedProjectForVersions(null)
    } catch (err) {
      setStatusMsg(`Error: ${(err as Error).message}`)
    } finally {
      setInstallingVersionId(null)
    }
  }

  // Quick 1-click install latest compatible
  const handleQuickInstall = async (proj: ModrinthProject) => {
    if (!server) return
    handleOpenVersions(proj)
  }

  const handleCheckUpdates = async () => {
    if (!server) return
    setLoading(true)
    try {
      const next = await window.api.checkAddonUpdates(server.id)
      setInstalled(next)
      setStatusMsg('Checked Modrinth for updates.')
    } finally {
      setLoading(false)
    }
  }

  if (!server) {
    return (
      <div className="p-8 text-center text-bh-muted text-sm">
        No server selected. Select a server to manage mods, plugins, and datapacks.
      </div>
    )
  }

  const filteredInstalled =
    projectType === 'modpack'
      ? installed
      : installed.filter((item) => {
          if (projectType === 'mod') return item.type === 'mod'
          if (projectType === 'plugin') return item.type === 'plugin'
          if (projectType === 'datapack') return item.type === 'datapack'
          return true
        })

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Bar */}
      <div className="bg-bh-card border border-bh-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl badge-accent">
            {projectType === 'modpack' ? (
              <Package className="w-5 h-5 text-bh-accent" />
            ) : projectType === 'datapack' ? (
              <FileCode className="w-5 h-5 text-bh-accent" />
            ) : (
              <Puzzle className="w-5 h-5 text-bh-accent" />
            )}
          </div>
          <div>
            <h2 className="text-base font-extrabold text-bh-text flex items-center gap-2">
              Modrinth Addon & Content Hub
              <span className="text-[10px] px-2 py-0.5 rounded-full badge-accent uppercase font-bold">
                {projectType}s
              </span>
            </h2>
            <p className="text-xs text-bh-muted">
              Choose exact version, resolve dependencies automatically & deploy directly to {server.name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!hideServerSelector && (
            <select
              value={server.id}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs font-bold text-bh-text"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.software} {s.version})
                </option>
              ))}
            </select>
          )}

          {/* Category Tabs: Mods, Plugins, Data Packs, Modpacks */}
          <div className="flex bg-bh-panel border border-bh-border rounded-xl p-0.5">
            {[
              { id: 'mod', label: 'Mods' },
              { id: 'plugin', label: 'Plugins' },
              { id: 'datapack', label: 'Data Packs' },
              { id: 'modpack', label: 'Modpacks' }
            ].map((pt) => (
              <button
                key={pt.id}
                onClick={() => {
                  setProjectType(pt.id as any)
                  setTab('browse')
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  projectType === pt.id
                    ? 'btn-accent font-bold'
                    : 'text-bh-muted hover:text-bh-text hover:bg-white/5'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setTab(tab === 'browse' ? 'installed' : 'browse')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              tab === 'installed'
                ? 'btn-accent font-bold'
                : 'bg-bh-panel hover:bg-white/5 text-bh-text border-bh-border'
            }`}
          >
            {tab === 'browse' ? `Installed (${installed.length})` : 'Browse Modrinth'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-bh-accentSubtle border border-bh-accentBorder text-bh-accent text-xs flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg('')} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {tab === 'browse' ? (
        <>
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-bh-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadSearch()}
                placeholder={`Search Modrinth ${projectType}s (e.g. Lithium, EssentialsX, Incendium, Cobblemon)...`}
                className="w-full bg-bh-card border border-bh-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-bh-text focus:outline-none focus:border-bh-accent"
              />
            </div>
            <button
              onClick={loadSearch}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl btn-accent text-xs font-bold flex items-center gap-1.5 shrink-0"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Search
            </button>
          </div>

          {/* Results Grid */}
          {results.length === 0 && !loading ? (
            <div className="bg-bh-card border border-dashed border-bh-border rounded-2xl p-12 text-center space-y-2">
              <p className="text-sm font-bold text-bh-text">No {projectType}s found</p>
              <p className="text-xs text-bh-muted">
                Try searching for a different keyword or switch categories above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((proj) => {
                return (
                  <div
                    key={proj.project_id}
                    className="card-hover bg-bh-card border border-bh-border rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-lg"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={proj.icon_url || './logo.png'}
                        alt={proj.title}
                        className="w-12 h-12 rounded-xl object-cover bg-bh-panel shrink-0 border border-white/5"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-bh-text truncate">{proj.title}</h4>
                        <p className="text-[11px] text-bh-muted">
                          by <span className="text-bh-text">{proj.author}</span> •{' '}
                          {(proj.downloads / 1000).toFixed(0)}k downloads
                        </p>
                        <p className="text-xs text-bh-muted mt-1.5 line-clamp-2">{proj.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-bh-border">
                      <div className="flex flex-wrap gap-1">
                        {proj.categories.slice(0, 3).map((cat) => (
                          <span
                            key={cat}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-bh-muted capitalize"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenVersions(proj)}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-bh-text border border-bh-border flex items-center gap-1"
                          title="View all available versions"
                        >
                          <Tag className="w-3 h-3 text-bh-muted" /> Versions
                        </button>
                        <button
                          onClick={() => handleQuickInstall(proj)}
                          className="px-3.5 py-1.5 rounded-xl btn-accent text-xs font-bold flex items-center gap-1 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" /> Install
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        /* Installed Manager */
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-bh-text">
                Installed Content on {server.name}
              </h3>
              <p className="text-xs text-bh-muted">
                Showing {filteredInstalled.length} installed {projectType} items
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCheckUpdates}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-bh-text border border-bh-border flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Check Updates
              </button>
              <button
                onClick={async () => {
                  const targetFolder =
                    projectType === 'datapack'
                      ? `${server.levelName || 'world'}/datapacks`
                      : projectType === 'plugin'
                        ? 'plugins'
                        : 'mods'
                  await window.api.uploadFilesDialog(server.id, targetFolder)
                  loadInstalled()
                }}
                className="px-3 py-1.5 rounded-xl btn-accent text-xs font-bold"
              >
                + Upload Custom {projectType === 'datapack' ? '.ZIP' : '.JAR'}
              </button>
            </div>
          </div>

          {filteredInstalled.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs text-bh-muted">
                No {projectType}s currently installed on {server.name}. Switch to &quot;Browse Modrinth&quot; to install with 1 click.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInstalled.map((item) => (
                <div
                  key={item.filename}
                  className="bg-bh-panel border border-bh-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-bh-text truncate">{item.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full badge-accent uppercase font-bold">
                        {item.type}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          item.enabled
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {item.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-bh-muted font-mono mt-0.5 truncate">
                      {item.filename} • {(item.size / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.updateAvailable && item.projectId && (
                      <button
                        onClick={async () => {
                          await window.api.installAddon({
                            serverId: server.id,
                            projectId: item.projectId,
                            versionId: item.updateAvailable?.id,
                            type: item.type
                          })
                          loadInstalled()
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" /> Update to{' '}
                        {item.updateAvailable.version_number}
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        setInstalled(
                          await window.api.toggleAddon(server.id, item.filename, item.type)
                        )
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-bh-text border border-bh-border flex items-center gap-1"
                    >
                      <Power className="w-3.5 h-3.5" /> {item.enabled ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      onClick={async () => {
                        if (confirm(`Remove "${item.filename}" from ${server.name}?`)) {
                          setInstalled(
                            await window.api.deleteAddon(server.id, item.filename, item.type)
                          )
                        }
                      }}
                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VERSION SELECTOR MODAL (Requirement #4: Choose WHICH version to install) */}
      {selectedProjectForVersions && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bh-panel border border-bh-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-4 border-b border-bh-border flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={selectedProjectForVersions.icon_url || './logo.png'}
                  alt={selectedProjectForVersions.title}
                  className="w-10 h-10 rounded-xl object-cover bg-bh-card shrink-0 border border-white/10"
                />
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-bh-text truncate">
                    Choose Version — {selectedProjectForVersions.title}
                  </h3>
                  <p className="text-xs text-bh-muted truncate">
                    Target Server: <strong className="text-bh-text">{server.name}</strong> ({server.software} {server.version})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedProjectForVersions(null)}
                className="p-1.5 rounded-lg text-bh-muted hover:text-bh-text hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Versions List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {loadingVersions ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-bh-muted">
                  <RefreshCw className="w-6 h-6 animate-spin text-bh-accent" />
                  <p className="text-xs">Fetching available releases from Modrinth...</p>
                </div>
              ) : availableVersions.length === 0 ? (
                <div className="py-12 text-center text-bh-muted space-y-2">
                  <p className="text-sm font-semibold text-bh-text">No versions found</p>
                  <p className="text-xs">
                    No releases found matching Minecraft {server.version} for this project.
                  </p>
                </div>
              ) : (
                availableVersions.map((ver) => {
                  const matchesGameVersion = ver.game_versions.includes(server.version)
                  const matchesLoader =
                    projectType === 'datapack' ||
                    ver.loaders.includes(server.software) ||
                    ver.loaders.includes('datapack') ||
                    (server.software === 'paper' && ver.loaders.some((l) => ['paper', 'spigot', 'bukkit'].includes(l)))

                  const isBusy = installingVersionId === ver.id

                  return (
                    <div
                      key={ver.id}
                      className={`bg-bh-card border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 transition ${
                        matchesGameVersion && matchesLoader
                          ? 'border-bh-accentBorder bg-bh-accentSubtle/30'
                          : 'border-bh-border hover:border-white/20'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-bh-text">
                            {ver.version_number}
                          </span>
                          <span className="text-[11px] font-semibold text-bh-muted truncate">
                            {ver.name}
                          </span>
                          {matchesGameVersion && matchesLoader && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full badge-accent font-bold flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Compatible
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-bh-muted">
                          <span className="font-semibold text-slate-300">MC:</span>
                          {ver.game_versions.slice(0, 4).map((gv) => (
                            <span
                              key={gv}
                              className={`px-1.5 py-0.5 rounded ${
                                gv === server.version
                                  ? 'bg-bh-accent text-white font-bold'
                                  : 'bg-white/5 text-bh-muted'
                              }`}
                            >
                              {gv}
                            </span>
                          ))}
                          {ver.game_versions.length > 4 && (
                            <span>+{ver.game_versions.length - 4} more</span>
                          )}

                          <span className="mx-1">•</span>
                          <span className="font-semibold text-slate-300">Loaders:</span>
                          {ver.loaders.map((ld) => (
                            <span key={ld} className="px-1.5 py-0.5 rounded bg-white/5 uppercase">
                              {ld}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        disabled={isBusy}
                        onClick={() => handleInstallSpecificVersion(selectedProjectForVersions, ver)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                          matchesGameVersion && matchesLoader
                            ? 'btn-accent shadow-md'
                            : 'bg-white/10 hover:bg-white/20 text-bh-text border border-bh-border'
                        }`}
                      >
                        {isBusy ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Install Version
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-bh-card border-t border-bh-border flex justify-between items-center text-xs text-bh-muted">
              <span>Showing {availableVersions.length} available versions on Modrinth</span>
              <button
                onClick={() => setSelectedProjectForVersions(null)}
                className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-bh-text font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
