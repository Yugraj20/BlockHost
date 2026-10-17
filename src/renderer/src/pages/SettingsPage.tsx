import React, { useEffect, useState } from 'react'
import {
  Palette,
  Cpu,
  HardDrive,
  Shield,
  Stethoscope,
  RefreshCw,
  Download,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Bell
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { DiagnosticsReport, JavaInstallation } from '../../../shared/types'

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, updater } = useAppStore()
  const [subTab, setSubTab] = useState<
    'appearance' | 'java' | 'storage' | 'security' | 'diagnostics' | 'updates'
  >('appearance')

  // Java state
  const [javas, setJavas] = useState<JavaInstallation[]>([])
  const [installingJava, setInstallingJava] = useState<number | null>(null)

  // Storage state
  const [storageStats, setStorageStats] = useState<any>(null)

  // Security PIN
  const [pinInput, setPinInput] = useState('')
  const [pinSaved, setPinSaved] = useState(false)

  // Diagnostics & Logs
  const [diag, setDiag] = useState<DiagnosticsReport | null>(null)
  const [appLogs, setAppLogs] = useState<string[]>([])
  const [copiedDiag, setCopiedDiag] = useState(false)

  useEffect(() => {
    if (subTab === 'java') {
      window.api.detectJava().then(setJavas)
    } else if (subTab === 'storage') {
      window.api.getStorageStats().then(setStorageStats)
    } else if (subTab === 'diagnostics') {
      window.api.getDiagnostics().then(setDiag)
      window.api.getAppLogs().then(setAppLogs)
    }
  }, [subTab])

  if (!settings) return null

  return (
    <div className="p-5 space-y-5">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center gap-2 bg-bh-card/90 border border-bh-border rounded-2xl p-3 shadow-xl">
        {[
          { id: 'appearance', label: 'Themes & Accessibility', icon: Palette },
          { id: 'java', label: 'Java Runtimes (Temurin)', icon: Cpu },
          { id: 'storage', label: 'Storage Management', icon: HardDrive },
          { id: 'security', label: 'Security, Notifications & Startup', icon: Shield },
          { id: 'diagnostics', label: 'Diagnostics & App Logs', icon: Stethoscope },
          { id: 'updates', label: 'Auto-Updates', icon: RefreshCw }
        ].map((t) => {
          const Icon = t.icon
          const active = subTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                active
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'text-bh-muted hover:text-bh-text hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 1. APPEARANCE, THEMES & ACCESSIBILITY */}
      {subTab === 'appearance' && (
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-6 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Theme Mode */}
            <div className="bg-bh-panel p-4 rounded-xl border border-bh-border space-y-2">
              <label className="text-xs font-bold text-bh-text">Color Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {(['dark', 'light', 'system'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => updateSettings({ theme: m })}
                    className={`py-2 rounded-lg text-xs font-semibold capitalize border ${
                      settings.theme === m
                        ? 'bg-emerald-500 text-white border-emerald-400'
                        : 'bg-bh-card text-bh-muted border-bh-border'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div className="bg-bh-panel p-4 rounded-xl border border-bh-border space-y-2">
              <label className="text-xs font-bold text-bh-text">Accent Palette</label>
              <div className="flex items-center gap-2.5 pt-1">
                {(
                  [
                    { id: 'indigo', cls: 'bg-indigo-500' },
                    { id: 'violet', cls: 'bg-violet-500' },
                    { id: 'cyan', cls: 'bg-cyan-500' },
                    { id: 'emerald', cls: 'bg-emerald-500' },
                    { id: 'amber', cls: 'bg-amber-500' },
                    { id: 'rose', cls: 'bg-rose-500' }
                  ] as const
                ).map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => updateSettings({ accentColor: acc.id })}
                    className={`w-8 h-8 rounded-xl ${acc.cls} ${
                      (settings.accentColor || 'indigo') === acc.id
                        ? 'ring-2 ring-white scale-110 shadow-lg'
                        : 'opacity-70 hover:opacity-100'
                    } transition`}
                    title={acc.id}
                  />
                ))}
              </div>
            </div>

            {/* Accessibility */}
            <div className="bg-bh-panel p-4 rounded-xl border border-bh-border space-y-2.5">
              <label className="text-xs font-bold text-bh-text">Accessibility & Scaling</label>
              <div className="flex items-center justify-between text-xs">
                <span className="text-bh-muted">Font Size Scale:</span>
                <select
                  value={settings.fontScale}
                  onChange={(e) => updateSettings({ fontScale: e.target.value as any })}
                  className="bg-bh-card border border-bh-border rounded-lg px-2 py-1 text-xs text-bh-text"
                >
                  <option value="sm">Compact (Small)</option>
                  <option value="md">Default (Medium)</option>
                  <option value="lg">Large (115%)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-bh-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
                  className="accent-emerald-500"
                />
                Reduced Motion (Disable UI animations)
              </label>
              <label className="flex items-center gap-2 text-xs text-bh-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.highContrast}
                  onChange={(e) => updateSettings({ highContrast: e.target.checked })}
                  className="accent-emerald-500"
                />
                High Contrast Borders
              </label>
            </div>
          </div>

          {/* Hero Banner Artwork Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-bh-text">
              Dashboard Hero Artwork
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-9 gap-2.5">
              <button
                key="gif"
                onClick={() => updateSettings({ backgroundArt: 'gif' })}
                className={`h-14 rounded-xl overflow-hidden border-2 transition relative ${
                  settings.backgroundArt === 'gif' || !settings.backgroundArt
                    ? 'border-emerald-400 scale-105 shadow-lg shadow-emerald-500/20'
                    : 'border-transparent opacity-75 hover:opacity-100'
                }`}
                title="4K Animated GIF (Code_Generated_Image.gif)"
              >
                <img
                  src="./Code_Generated_Image.gif"
                  alt="4K Animated GIF"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0.5 right-0.5 bg-black/85 text-[9px] px-1 rounded text-emerald-300 font-bold">GIF</span>
              </button>
              {Array.from({ length: 16 }, (_, i) => `bg-${i + 1}`).map((bgId) => (
                <button
                  key={bgId}
                  onClick={() => updateSettings({ backgroundArt: bgId })}
                  className={`h-14 rounded-xl overflow-hidden border-2 transition ${
                    settings.backgroundArt === bgId
                      ? 'border-emerald-400 scale-105'
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
        </div>
      )}

      {/* 2. JAVA RUNTIMES */}
      {subTab === 'java' && (
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-bh-text">
                Java Runtime Manager (Eclipse Temurin / Adoptium API)
              </h3>
              <p className="text-xs text-bh-muted">
                BlockHost automatically selects Java 8 for MC ≤1.16.5, Java 17 for 1.17–1.20.4, and Java 21+ for 1.20.5+.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {([8, 17, 21, 25] as const).map((major) => (
                <button
                  key={major}
                  disabled={installingJava !== null}
                  onClick={async () => {
                    setInstallingJava(major)
                    try {
                      await window.api.installTemurin(major)
                      setJavas(await window.api.detectJava())
                    } catch (err) {
                      alert((err as Error).message)
                    } finally {
                      setInstallingJava(null)
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5"
                >
                  {installingJava === major ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Install Java {major}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {javas.map((j) => (
              <div
                key={j.path}
                className="bg-bh-panel border border-bh-border rounded-xl p-3.5 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-bh-text">
                      Java {j.majorVersion} ({j.version})
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                      {j.vendor} • {j.arch}
                    </span>
                    {j.managed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold">
                        Managed by BlockHost
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-bh-muted mt-1">{j.path}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. STORAGE MANAGEMENT */}
      {subTab === 'storage' && (
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-5 shadow-xl">
          <h3 className="text-sm font-bold text-bh-text">
            Disk Usage, Cache Cleanup & Data Directories
          </h3>

          {storageStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-bh-panel p-4 rounded-xl border border-bh-border">
                <p className="text-xs text-bh-muted">Servers Storage</p>
                <p className="text-xl font-extrabold text-emerald-400">
                  {(storageStats.serversBytes / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <div className="bg-bh-panel p-4 rounded-xl border border-bh-border">
                <p className="text-xs text-bh-muted">Backups Archive</p>
                <p className="text-xl font-extrabold text-cyan-400">
                  {(storageStats.backupsBytes / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <div className="bg-bh-panel p-4 rounded-xl border border-bh-border">
                <p className="text-xs text-bh-muted">Managed Java Runtimes</p>
                <p className="text-xl font-extrabold text-violet-400">
                  {(storageStats.javaBytes / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <div className="bg-bh-panel p-4 rounded-xl border border-bh-border flex flex-col justify-between">
                <div>
                  <p className="text-xs text-bh-muted">Download Cache</p>
                  <p className="text-xl font-extrabold text-amber-400">
                    {(storageStats.cacheBytes / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await window.api.clearCache()
                    setStorageStats(await window.api.getStorageStats())
                  }}
                  className="mt-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-bh-text border border-bh-border"
                >
                  Purge Cache
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {[
              { label: 'Servers Directory', key: 'serversDir' as const, val: settings.serversDir },
              { label: 'Backups Directory', key: 'backupsDir' as const, val: settings.backupsDir },
              { label: 'Managed Java Directory', key: 'javaDir' as const, val: settings.javaDir }
            ].map((row) => (
              <div
                key={row.key}
                className="bg-bh-panel p-3.5 rounded-xl border border-bh-border flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-bh-text">{row.label}</p>
                  <p className="text-xs font-mono text-bh-muted truncate">{row.val}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.api.openPath(row.val)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-bh-text border border-bh-border flex items-center gap-1"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Open
                  </button>
                  <button
                    onClick={async () => {
                      const picked = await window.api.pickFolder()
                      if (picked) updateSettings({ [row.key]: picked })
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold"
                  >
                    Change Path
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SECURITY, NOTIFICATIONS & STARTUP */}
      {subTab === 'security' && (
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-5 shadow-xl">
          <div className="bg-bh-panel p-4 rounded-xl border border-bh-border space-y-3">
            <h4 className="text-xs font-bold text-bh-text uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> Application PIN Lock & Tray Behavior
            </h4>
            <p className="text-xs text-bh-muted">
              Protect server controls with a security PIN. Leave empty to disable the lock.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder={settings.pinEnabled ? 'Enter new PIN or leave blank to clear' : 'Set 4-8 digit PIN'}
                className="flex-1 bg-bh-card border border-bh-border rounded-xl px-3 py-1.5 text-xs text-bh-text"
              />
              <button
                onClick={async () => {
                  const next = await window.api.setSecurityPin(pinInput)
                  useAppStore.setState({ settings: next })
                  setPinInput('')
                  setPinSaved(true)
                  setTimeout(() => setPinSaved(false), 1500)
                }}
                className="px-4 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold"
              >
                {pinSaved ? 'Saved!' : settings.pinEnabled ? 'Update / Clear PIN' : 'Enable PIN'}
              </button>
            </div>

            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2 text-xs text-bh-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.minimizeToTray}
                  onChange={(e) => updateSettings({ minimizeToTray: e.target.checked })}
                  className="accent-emerald-500"
                />
                Minimize BlockHost to Windows System Tray when closing window
              </label>
              <label className="flex items-center gap-2 text-xs text-bh-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.launchOnStartup}
                  onChange={(e) => updateSettings({ launchOnStartup: e.target.checked })}
                  className="accent-emerald-500"
                />
                Launch BlockHost automatically at Windows login
              </label>
            </div>
          </div>

          <div className="bg-bh-panel p-4 rounded-xl border border-bh-border space-y-2.5">
            <h4 className="text-xs font-bold text-bh-text uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-400" /> Notification Preferences
            </h4>

            {[
              { key: 'notificationsEnabled' as const, label: 'Enable In-App Notification Center' },
              { key: 'desktopToastsEnabled' as const, label: 'Show Native Windows Toast Notifications' },
              { key: 'notifyOnCrash' as const, label: 'Alert when a server crashes' },
              { key: 'notifyOnBackup' as const, label: 'Alert when a backup finishes' },
              { key: 'notifyOnPlayerJoin' as const, label: 'Alert when a player joins a server' }
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-xs text-bh-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[item.key]}
                  onChange={(e) => updateSettings({ [item.key]: e.target.checked })}
                  className="accent-emerald-500"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 5. DIAGNOSTICS & LOGS */}
      {subTab === 'diagnostics' && (
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-bh-text">System Self-Tests & Application Logs</h3>
            <button
              onClick={() => {
                if (!diag) return
                navigator.clipboard.writeText(JSON.stringify(diag, null, 2))
                setCopiedDiag(true)
                setTimeout(() => setCopiedDiag(false), 1500)
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              {copiedDiag ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedDiag ? 'Copied Report!' : 'Copy Diagnostics JSON'}
            </button>
          </div>

          {diag && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {diag.selfTests.map((t) => (
                <div
                  key={t.name}
                  className="bg-bh-panel border border-bh-border rounded-xl p-3 flex items-center gap-3"
                >
                  {t.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <p className="text-xs font-bold text-bh-text">{t.name}</p>
                    <p className="text-[11px] text-bh-muted">{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-bh-text mb-2">Application Log (`blockhost.log`)</p>
            <div className="h-60 overflow-y-auto bg-[#070b13] border border-bh-border rounded-xl p-3 font-mono text-xs text-slate-300 space-y-0.5 select-text">
              {appLogs.map((l, idx) => (
                <div key={idx}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. AUTO-UPDATES */}
      {subTab === 'updates' && (
        <div className="bg-bh-card/90 border border-bh-border rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-bh-text">
            Auto-Updater Configuration (GitHub Releases Feed)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-bh-muted mb-1">GitHub Owner / Organization</label>
              <input
                type="text"
                value={settings.updateFeedOwner}
                onChange={(e) => updateSettings({ updateFeedOwner: e.target.value })}
                className="w-full bg-bh-panel border border-bh-border rounded-xl px-3 py-2 text-xs text-bh-text font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-bh-muted mb-1">GitHub Repository</label>
              <input
                type="text"
                value={settings.updateFeedRepo}
                onChange={(e) => updateSettings({ updateFeedRepo: e.target.value })}
                className="w-full bg-bh-panel border border-bh-border rounded-xl px-3 py-2 text-xs text-bh-text font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-bh-panel p-4 rounded-xl border border-bh-border">
            <div>
              <p className="text-xs font-bold text-bh-text">Current Version: v0.1.0-beta</p>
              <p className="text-xs text-bh-muted mt-0.5">
                {updater.message || 'Click "Check for Updates" to query the release feed.'}
              </p>
            </div>
            <button
              onClick={() => window.api.checkForUpdates()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Check for Updates
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
