import React, { useState } from 'react'
import {
  Bell,
  Download,
  Settings,
  Minus,
  Square,
  X,
  Lock,
  BookOpen,
  Sun,
  Moon,
  Trash2,
  CheckCheck
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'

export const TitleBar: React.FC = () => {
  const {
    notifications,
    downloads,
    settings,
    setActiveTab,
    updateSettings,
    setLocked
  } = useAppStore()
  const [showNotifs, setShowNotifs] = useState(false)
  const [showDownloads, setShowDownloads] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length
  const activeDownloads = downloads.filter((d) => d.status === 'downloading' || d.status === 'verifying')

  return (
    <header className="h-9 bg-bh-panel/85 backdrop-blur-md border-b border-bh-border flex items-center justify-between px-3 select-none drag-region z-40">
      <div className="flex items-center gap-2 text-xs text-bh-muted">
        <span className="w-2 h-2 rounded-full bg-bh-accent animate-pulse" />
        <span className="font-semibold text-bh-text">VoxelPulse Desktop Engine</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full badge-accent font-bold">
          v0.2.1-beta
        </span>
        {activeDownloads.length > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full badge-accent text-[11px] font-semibold">
            Downloading ({activeDownloads.length})...
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 no-drag relative">
        {/* Theme Quick Toggle */}
        <button
          onClick={() =>
            updateSettings({
              theme: settings?.theme === 'light' ? 'dark' : 'light'
            })
          }
          title="Toggle Dark / Light Mode"
          aria-label="Toggle Dark or Light Mode"
          className="p-1.5 rounded-md text-bh-muted hover:text-bh-text hover:bg-white/5 transition"
        >
          {settings?.theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        {/* Documentation Button */}
        <button
          onClick={() => setActiveTab('docs')}
          title="Documentation & Help"
          aria-label="Documentation and Help"
          className="p-1.5 rounded-md text-bh-muted hover:text-bh-text hover:bg-white/5 transition"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>

        {/* Downloads Popover Trigger */}
        <button
          onClick={() => {
            setShowDownloads(!showDownloads)
            setShowNotifs(false)
          }}
          title="Downloads Queue"
          aria-label="Downloads Queue"
          className="p-1.5 rounded-md text-bh-muted hover:text-bh-text hover:bg-white/5 transition relative"
        >
          <Download className="w-3.5 h-3.5" />
          {activeDownloads.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-bh-accent" />
          )}
        </button>

        {/* Notifications Popover Trigger */}
        <button
          onClick={() => {
            setShowNotifs(!showNotifs)
            setShowDownloads(false)
            if (!showNotifs && unreadCount > 0) {
              window.api.markNotificationsRead().then((list) => {
                useAppStore.setState({ notifications: list })
              })
            }
          }}
          title="Notifications"
          aria-label="Notifications"
          className="p-1.5 rounded-md text-bh-muted hover:text-bh-text hover:bg-white/5 transition relative"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[14px] h-[14px] rounded-full btn-accent text-[9px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Optional PIN Lock button */}
        {settings?.pinEnabled && (
          <button
            onClick={() => setLocked(true)}
            title="Lock VoxelPulse (PIN)"
            aria-label="Lock App"
            className="p-1.5 rounded-md text-bh-muted hover:text-amber-400 hover:bg-white/5 transition"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Settings shortcut */}
        <button
          onClick={() => setActiveTab('settings')}
          title="Settings"
          aria-label="Settings"
          className="p-1.5 rounded-md text-bh-muted hover:text-bh-text hover:bg-white/5 transition"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <div className="h-3.5 w-[1px] bg-bh-border mx-1" />

        {/* Window Controls */}
        <button
          onClick={() => window.api.minimizeWindow()}
          aria-label="Minimize Window"
          className="p-1.5 rounded-md text-bh-muted hover:text-bh-text hover:bg-white/5 transition"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => window.api.maximizeWindow()}
          aria-label="Maximize Window"
          className="p-1.5 rounded-md text-bh-muted hover:text-bh-text hover:bg-white/5 transition"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => window.api.closeWindow()}
          aria-label="Close Window"
          className="p-1.5 rounded-md text-bh-muted hover:text-white hover:bg-rose-500/80 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Downloads Dropdown */}
        {showDownloads && (
          <div className="absolute right-12 top-9 w-80 bg-bh-panel border border-bh-border rounded-xl shadow-2xl p-3 z-50">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-bh-border">
              <span className="text-xs font-semibold text-bh-text">Downloads & Installers</span>
              <span className="text-[11px] text-bh-muted">{downloads.length} total</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {downloads.length === 0 ? (
                <p className="text-xs text-bh-muted py-4 text-center">No downloads in this session.</p>
              ) : (
                downloads.map((d) => {
                  const pct =
                    d.totalBytes > 0 ? Math.min(100, Math.round((d.downloadedBytes / d.totalBytes) * 100)) : 100
                  return (
                    <div key={d.id} className="bg-bh-card/80 p-2 rounded-lg border border-bh-border">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium truncate max-w-[180px]">{d.title}</span>
                        <span className="text-[11px] text-emerald-400 uppercase">{d.status}</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            d.status === 'failed' ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {d.error && <p className="text-[11px] text-rose-400 mt-1">{d.error}</p>}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Notifications Dropdown */}
        {showNotifs && (
          <div className="absolute right-8 top-9 w-80 bg-bh-panel border border-bh-border rounded-xl shadow-2xl p-3 z-50">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-bh-border">
              <span className="text-xs font-semibold text-bh-text">Notification Center</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    window.api.clearNotifications().then(() => useAppStore.setState({ notifications: [] }))
                  }
                  className="text-[11px] text-bh-muted hover:text-rose-400 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {notifications.length === 0 ? (
                <div className="text-xs text-bh-muted py-4 text-center flex flex-col items-center gap-1">
                  <CheckCheck className="w-5 h-5 text-emerald-400/60" />
                  <span>All caught up!</span>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="bg-bh-card/80 p-2.5 rounded-lg border border-bh-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-bh-text">{n.title}</span>
                      <span className="text-[10px] text-bh-muted">
                        {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-bh-muted mt-0.5">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
