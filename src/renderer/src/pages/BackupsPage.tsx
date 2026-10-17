import React, { useState } from 'react'
import {
  History,
  Plus,
  RotateCcw,
  Trash2,
  FolderOpen,
  CalendarClock,
  Play,
  RefreshCw,
  ShieldCheck
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'

interface BackupsPageProps {
  serverId?: string
  hideServerSelector?: boolean
}

export const BackupsPage: React.FC<BackupsPageProps> = ({ serverId, hideServerSelector = false }) => {
  const {
    servers,
    selectedServerId,
    setSelectedServerId,
    backups,
    schedules,
    refreshBackups,
    refreshSchedules
  } = useAppStore()

  const activeServerId = serverId || selectedServerId || servers[0]?.id
  const server = servers.find((s) => s.id === activeServerId) || servers[0]
  const [scope, setScope] = useState<'full' | 'world'>('full')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmRestoreTarget, setConfirmRestoreTarget] = useState<{ id: string; name: string } | null>(null)

  // Schedule form state
  const [schedName, setSchedName] = useState('Daily World Backup')
  const [schedCron, setSchedCron] = useState('0 3 * * *')
  const [schedAction, setSchedAction] = useState<'backup' | 'restart' | 'command' | 'broadcast'>('backup')
  const [schedPayload, setSchedPayload] = useState('full')

  const serverBackups = backups.filter((b) => !server || b.serverId === server.id)
  const serverSchedules = schedules.filter((s) => !server || s.serverId === server.id)

  const handleCreateBackup = async () => {
    if (!server) return
    setBusy(true)
    setStatusBanner(null)
    try {
      await window.api.createBackup({
        serverId: server.id,
        scope,
        note: note || undefined
      })
      setNote('')
      await refreshBackups()
      setStatusBanner({ type: 'success', text: 'Backup snapshot created successfully.' })
    } catch (err) {
      setStatusBanner({ type: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (backupId: string, _name: string) => {
    setConfirmRestoreTarget(null)
    setBusy(true)
    setStatusBanner(null)
    try {
      await window.api.restoreBackup(backupId, true)
      await refreshBackups()
      setStatusBanner({
        type: 'success',
        text: 'Backup restored! Pre-restore safety snapshot saved. You can now start the server.'
      })
    } catch (err) {
      setStatusBanner({ type: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!server) return
    setStatusBanner(null)
    try {
      await window.api.saveSchedule({
        serverId: server.id,
        name: schedName,
        cron: schedCron,
        action: schedAction,
        payload: schedPayload,
        enabled: true
      })
      await refreshSchedules()
      setStatusBanner({ type: 'success', text: `Scheduled task "${schedName}" saved.` })
    } catch (err) {
      setStatusBanner({ type: 'error', text: (err as Error).message })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {statusBanner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span className="font-medium">{statusBanner.text}</span>
          <button
            onClick={() => setStatusBanner(null)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-bh-muted hover:text-bh-text font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {confirmRestoreTarget && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-amber-200">
            <p className="font-bold">Restore Backup &quot;{confirmRestoreTarget.name}&quot;?</p>
            <p className="text-amber-300/80 mt-0.5">
              BlockHost will automatically take a Pre-Restore Safety Snapshot before restoring.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRestore(confirmRestoreTarget.id, confirmRestoreTarget.name)}
              disabled={busy}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
            >
              Confirm Restore
            </button>
            <button
              onClick={() => setConfirmRestoreTarget(null)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-bh-muted hover:text-bh-text text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      {!hideServerSelector && (
        <div className="bg-bh-card border border-bh-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl badge-accent">
              <History className="w-5 h-5 text-bh-accent" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-bh-text">
                Backups, Restore & Task Scheduler
              </h2>
              <p className="text-xs text-bh-muted">
                Live `save-off` / `save-all` snapshots, safety-first restores, and cron automation
              </p>
            </div>
          </div>

          <select
            value={server?.id || ''}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT 7 COLS: Backups & Restore */}
        <div className="lg:col-span-7 bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-bh-text flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Server Snapshots ({serverBackups.length})
            </h3>

            <div className="flex items-center gap-2">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'full' | 'world')}
                className="bg-bh-panel border border-bh-border rounded-xl px-2.5 py-1.5 text-xs text-bh-text"
              >
                <option value="full">Full Server ZIP</option>
                <option value="world">World Only ZIP</option>
              </select>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note..."
                className="bg-bh-panel border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text w-40"
              />
              <button
                onClick={handleCreateBackup}
                disabled={busy}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
              >
                {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create Backup
              </button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {serverBackups.length === 0 ? (
              <p className="text-xs text-bh-muted py-8 text-center">
                No backups created yet for {server?.name}. Click &quot;Create Backup&quot; above.
              </p>
            ) : (
              serverBackups.map((bk) => (
                <div
                  key={bk.id}
                  className="bg-bh-panel border border-bh-border rounded-xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-bh-text truncate">{bk.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 uppercase font-semibold">
                        {bk.scope}
                      </span>
                    </div>
                    <p className="text-[11px] text-bh-muted mt-0.5">
                      {new Date(bk.createdAt).toLocaleString()} •{' '}
                      {(bk.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                      {bk.note ? ` • "${bk.note}"` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setConfirmRestoreTarget({ id: bk.id, name: bk.name })}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                    <button
                      onClick={() => window.api.openPath(bk.filePath)}
                      title="Show in Explorer"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-bh-muted hover:text-bh-text"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        await window.api.deleteBackup(bk.id)
                        await refreshBackups()
                      }}
                      title="Delete Backup"
                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT 5 COLS: Cron Task Scheduler */}
        <div className="lg:col-span-5 bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-bh-text flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-400" /> Automated Cron Schedules
          </h3>

          <form onSubmit={handleAddSchedule} className="bg-bh-panel p-3.5 rounded-xl border border-bh-border space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-bh-muted mb-1">Task Name</label>
                <input
                  type="text"
                  required
                  value={schedName}
                  onChange={(e) => setSchedName(e.target.value)}
                  className="w-full bg-bh-card border border-bh-border rounded-lg px-2.5 py-1.5 text-xs text-bh-text"
                />
              </div>
              <div>
                <label className="block text-[11px] text-bh-muted mb-1">Cron Expression</label>
                <input
                  type="text"
                  required
                  value={schedCron}
                  onChange={(e) => setSchedCron(e.target.value)}
                  className="w-full bg-bh-card border border-bh-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-bh-text"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-bh-muted mb-1">Action</label>
                <select
                  value={schedAction}
                  onChange={(e) => setSchedAction(e.target.value as any)}
                  className="w-full bg-bh-card border border-bh-border rounded-lg px-2.5 py-1.5 text-xs text-bh-text"
                >
                  <option value="backup">Create Backup</option>
                  <option value="restart">Restart Server</option>
                  <option value="command">Run Console Command</option>
                  <option value="broadcast">Broadcast Message</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-bh-muted mb-1">Payload / Command</label>
                <input
                  type="text"
                  value={schedPayload}
                  onChange={(e) => setSchedPayload(e.target.value)}
                  placeholder="full | save-all | Hello!"
                  className="w-full bg-bh-card border border-bh-border rounded-lg px-2.5 py-1.5 text-xs text-bh-text"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold"
            >
              + Add Scheduled Job
            </button>
          </form>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {serverSchedules.map((job) => (
              <div
                key={job.id}
                className="bg-bh-panel border border-bh-border rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-bh-text">{job.name}</p>
                  <p className="text-[11px] text-bh-muted font-mono">
                    {job.cron} • {job.action.toUpperCase()} ({job.payload})
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      await window.api.runScheduleNow(job.id)
                      await refreshBackups()
                      await refreshSchedules()
                    }}
                    title="Run Now"
                    className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <button
                    onClick={async () => {
                      await window.api.deleteSchedule(job.id)
                      await refreshSchedules()
                    }}
                    title="Delete Schedule"
                    className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
